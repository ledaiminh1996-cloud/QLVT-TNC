import type { Env, User, Row } from "./types.ts";
/** This predicate is repeated by the mutation-lock trigger, so a concurrent issue wins safely. */
export function dependencySql(alias = "d"): string {
  return `EXISTS(SELECT 1 FROM stock_source_allocations a JOIN inventory_document_lines l ON l.id=a.source_line_id WHERE l.document_id=${alias}.posted_inventory_id) OR EXISTS(SELECT 1 FROM stock_cost_dependencies a JOIN inventory_document_lines l ON l.id=a.source_line_id WHERE l.document_id=${alias}.posted_inventory_id) OR EXISTS(SELECT 1 FROM inventory_document_lines l LEFT JOIN stock_lots s ON s.source_line_id=l.id WHERE l.document_id=${alias}.posted_inventory_id AND (s.source_line_id IS NULL OR s.remaining_quantity_milli<>s.initial_quantity_milli)) OR EXISTS(SELECT 1 FROM document_draft_lines x JOIN inventory_document_lines l ON l.id=json_extract(x.line_json,'$.source_line_id') JOIN document_drafts other ON other.id=x.document_id WHERE l.document_id=${alias}.posted_inventory_id AND other.id<>${alias}.id AND other.status<>'cancelled' AND other.deleted_at IS NULL)`;
}
export async function receiptCanModify(env: Env, id: string) {
  const row = await env.DB.prepare(
    `SELECT kind,status,posted_inventory_id,deleted_at,(${dependencySql()}) AS used FROM document_drafts d WHERE id=?`,
  )
    .bind(id)
    .first<Row>();
  return (
    !!row &&
    row.kind === "receipt" &&
    row.status !== "cancelled" &&
    !row.deleted_at &&
    !!row.posted_inventory_id &&
    row.used === 0
  );
}
export async function receiptRollback(
  env: Env,
  id: string,
  expected: number,
  user: User,
  remove = false,
): Promise<D1PreparedStatement[]> {
  const rows = await env.DB.prepare(
    "SELECT l.*,s.stock_state FROM inventory_document_lines l JOIN document_drafts d ON d.posted_inventory_id=l.document_id JOIN stock_lots s ON s.source_line_id=l.id WHERE d.id=?",
  )
    .bind(id)
    .all<Row>();
  const statements = [
    env.DB.prepare(
      "INSERT INTO receipt_mutation_locks(document_id,expected_version,actor_id,mode) VALUES (?,?,?,?)",
    ).bind(id, expected, user.id, remove ? "delete" : "edit"),
  ];
  for (const row of rows.results) {
    statements.push(
      env.DB.prepare(
        "UPDATE stock_balances SET quantity_milli=quantity_milli-?,value_vnd=value_vnd-? WHERE part_id=? AND warehouse_id=?",
      ).bind(
        row.quantity_milli,
        row.amount_vnd,
        row.part_id,
        row.to_warehouse_id,
      ),
      env.DB.prepare(
        "UPDATE stock_buckets SET quantity_milli=quantity_milli-?,value_vnd=value_vnd-?,version=version+1 WHERE part_id=? AND warehouse_id=? AND stock_state=?",
      ).bind(
        row.quantity_milli,
        row.amount_vnd,
        row.part_id,
        row.to_warehouse_id,
        row.stock_state,
      ),
      env.DB.prepare(
        "DELETE FROM inventory_serials WHERE document_line_id=? AND status='in_stock'",
      ).bind(row.id),
      env.DB.prepare("DELETE FROM stock_lots WHERE source_line_id=?").bind(
        row.id,
      ),
    );
    if (!remove)
      statements.push(
        env.DB.prepare(
          "DELETE FROM receipt_line_details WHERE inventory_line_id=?",
        ).bind(row.id),
        env.DB.prepare(
          "DELETE FROM stock_movements WHERE document_line_id=?",
        ).bind(row.id),
        env.DB.prepare("DELETE FROM inventory_document_lines WHERE id=?").bind(
          row.id,
        ),
      );
  }
  if (remove)
    statements.push(
      env.DB.prepare(
        "UPDATE inventory_documents SET status='cancelled',posted_by=NULL,posted_at=NULL WHERE id=(SELECT posted_inventory_id FROM document_drafts WHERE id=?)",
      ).bind(id),
      env.DB.prepare(
        "UPDATE document_drafts SET status='cancelled',deleted_at=strftime('%Y-%m-%dT%H:%M:%fZ','now'),version=version+1 WHERE id=?",
      ).bind(id),
    );
  return statements;
}

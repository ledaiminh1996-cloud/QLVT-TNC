import { useEffect, useRef, useState } from "react";
import {
  Plus,
  RefreshCw,
  Pencil,
  History,
  Printer,
  Upload,
  Download,
  Eye,
} from "lucide-react";
import { documentKinds, editableDraft } from "../../shared/documents";
import type {
  DocumentKind,
  DocumentRecord,
  DocumentSummary,
} from "../../shared/documents";
import type { DocumentClient, DocumentPage } from "./documentClient";
import type { CatalogClient, Session } from "../api/catalogClient";
import { accessMessage } from "../api/catalogClient";
import { docButton, docInput } from "./CatalogPicker";
import { DocumentEditor, money } from "./DocumentEditor";
import { DocumentHistory } from "./DocumentHistory";
import { DocumentWorkflows } from "./DocumentWorkflows";
import { DocumentBulkImport } from "./DocumentBulkImport";

import { StatusBadge } from "../components/StatusBadge";
import { MenuIcon } from "../components/MenuIcon";

import { DocumentList } from "./DocumentList";
export function DocumentsWorkspace({
  menu,
  api,
  documents,
  user,
  createToken = 0,
}: {
  menu: string;
  api: CatalogClient;
  documents: DocumentClient;
  user: NonNullable<Session["user"]>;
  createToken?: number;
}) {
  const options = (Object.keys(documentKinds) as DocumentKind[]).filter(
      (kind) => documentKinds[kind].menu === menu,
    ),
    [selected, setSelected] = useState<DocumentKind>(options[0] ?? "receipt");
  const [openingMode, setOpeningMode] = useState<"stock" | "in_use">("stock");
  const kind = options.includes(selected)
    ? selected
    : (options[0] ?? "receipt");
  if (menu === "ht_quy_trinh")
    return (
      <DocumentWorkflows
        api={api}
        documents={documents}
        canEdit={user.role === "admin"}
      />
    );
  return (
    <div
      className={
        ["receipt", "issue", "recovery"].includes(kind)
          ? "flex min-h-0 flex-1 flex-col gap-2"
          : "space-y-3"
      }
    >
      {options.length > 1 && (
        <nav
          role="tablist"
          aria-label="Loại điều chuyển"
          className="flex flex-wrap gap-2"
        >
          {options.map((key) => (
            <button
              key={key}
              role="tab"
              aria-selected={kind === key}
              className={
                docButton +
                (kind === key
                  ? " !border-blue-600 !bg-blue-50 !text-blue-700"
                  : "")
              }
              onClick={() => setSelected(key)}
            >
              {documentKinds[key].label}
            </button>
          ))}
        </nav>
      )}
      {kind === "opening" && (
        <nav
          role="tablist"
          aria-label="Loại phiếu đầu kỳ"
          className="flex flex-wrap gap-2"
        >
          {(["stock", "in_use"] as const).map((mode) => (
            <button
              key={mode}
              type="button"
              role="tab"
              aria-selected={openingMode === mode}
              className={
                docButton +
                (openingMode === mode
                  ? " !border-blue-600 !bg-blue-50 !text-blue-700"
                  : "")
              }
              onClick={() => setOpeningMode(mode)}
            >
              {mode === "in_use"
                ? "Vật tư đang sử dụng đầu kỳ"
                : "Tồn kho đầu kỳ"}
            </button>
          ))}
        </nav>
      )}
      <DocumentList
        openingMode={kind === "opening" ? openingMode : undefined}
        key={kind + ":" + (kind === "opening" ? openingMode : "")}
        kind={kind}
        api={api}
        documents={documents}
        user={user}
        createToken={createToken}
      />
    </div>
  );
}

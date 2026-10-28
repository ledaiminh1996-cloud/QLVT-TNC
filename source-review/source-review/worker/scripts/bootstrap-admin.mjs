import { parseArgs } from 'node:util';
import { writeFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';

// Generates a reviewable SQL file only. Never connects to a local/remote DB.
const { values } = parseArgs({ options: {
  email: { type: 'string' }, subject: { type: 'string' }, name: { type: 'string' }, out: { type: 'string' },
} });
if (!values.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email) || !values.subject?.trim() || !values.name?.trim() || !values.out) {
  throw new Error('Usage: node scripts/bootstrap-admin.mjs --email EMAIL --subject ACCESS_SUB --name NAME --out FILE.sql');
}
const literal = value => `'${value.replace(/'/g, "''")}'`;
const id = randomUUID();
const request = randomUUID();
const sql = `-- First administrator only. Verify the signed identity returned by /api/auth/me.
-- No-op if any administrator already exists; subsequent users use the admin API.
INSERT INTO app_users (id, auth_subject, email, display_name, role)
SELECT ${[id, values.subject.trim(), values.email.trim().toLowerCase(), values.name.trim(), 'admin'].map(literal).join(', ')}
WHERE NOT EXISTS (SELECT 1 FROM app_users WHERE role = 'admin');
INSERT INTO audit_events (id, actor_id, action, entity_type, entity_id, after_json, request_id)
SELECT ${literal(randomUUID())}, ${literal(id)}, 'user.bootstrap', 'users', ${literal(id)},
json_object('id', ${literal(id)}, 'role', 'admin'), ${literal(request)} WHERE changes() = 1;
`;
writeFileSync(values.out, sql, { encoding: 'utf8', flag: 'wx' });
console.log(`Created ${values.out}. No database was changed.`);

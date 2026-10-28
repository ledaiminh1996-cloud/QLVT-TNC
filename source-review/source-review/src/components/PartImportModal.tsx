import React, { useRef, useState } from 'react';
import { readSheet } from 'read-excel-file/browser';
import { convertPartImport, parseDelimited } from '../api/partImport.ts';
import { accessMessage, CatalogApiError } from '../api/catalogClient.ts';
import type { CatalogClient } from '../api/catalogClient.ts';
import { exportToCSV } from '../utils/inventoryUtils';

export function PartImportModal({ api, onClose, onImported }: { api: CatalogClient; onClose: () => void; onImported: (count: number) => void }) {
  const [raw, setRaw] = useState('');
  const [rows, setRows] = useState<Record<string, string | number | null>[] | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const batch = useRef(crypto.randomUUID());
  function changed() { setRows(null); setError(''); batch.current = crypto.randomUUID(); }
  function analyze(table: unknown[][]) {
    try { setRows(convertPartImport(table)); setError(''); batch.current = crypto.randomUUID(); }
    catch (failure) { setRows(null); setError((failure as Error).message); }
  }
  async function fileSelected(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]; if (!file) return;
    changed(); setRaw(''); setBusy(true);
    try {
      if (file.size > 5 * 1024 * 1024) throw new Error('File vượt quá 5 MB.');
      if (/\.xlsx$/i.test(file.name)) analyze(await readSheet(file));
      else if (/\.(csv|txt|tsv)$/i.test(file.name)) { const text = await file.text(); setRaw(text); analyze(parseDelimited(text)); }
      else throw new Error('Chọn file .xlsx, .csv, .tsv hoặc .txt. File .xls cần lưu lại thành .xlsx.');
    } catch (failure) { setError((failure as Error).message); } finally { setBusy(false); event.target.value = ''; }
  }
  async function save() {
    if (!rows || lock.current) return; lock.current = true; setBusy(true); setError('');
    try { const saved = await api.importParts(rows, batch.current); onImported(saved.length); }
    catch (failure) { setError(failure instanceof CatalogApiError ? accessMessage(failure) : 'Chưa xác nhận được kết quả nhập. Hãy thử lại với nguyên nội dung này để kiểm tra lượt nhập, tránh tạo trùng.'); }
    finally { lock.current = false; setBusy(false); }
  }
  function template() {
    const columns = ['Loại hàng', 'Mã đối tượng', 'Mã nhóm', 'Tên vật tư', 'ĐVT', 'Đơn giá (VNĐ)', 'Tồn kho tối thiểu', 'Đơn vị tồn tối thiểu', 'Tuổi thọ (giờ)', 'Mã vật tư'];
    exportToCSV('Mau_Import_VT_TB', [{ 'Loại hàng': 'M', 'Mã đối tượng': 'IN', 'Mã nhóm': 'TDONG', 'Tên vật tư': 'Vật tư mẫu — thay bằng dữ liệu thật', 'ĐVT': 'Cái', 'Đơn giá (VNĐ)': 0, 'Tồn kho tối thiểu': 0, 'Đơn vị tồn tối thiểu': 'Cái', 'Tuổi thọ (giờ)': '', 'Mã vật tư': '' }], columns.map(key => ({ key, label: key })));
  }
  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4"><div role="dialog" aria-modal="true" aria-labelledby="part-import-title" className="max-h-[90vh] w-full max-w-4xl overflow-auto rounded-2xl border border-slate-200 bg-white p-5 shadow-xl">
    <h2 id="part-import-title" className="text-base font-bold text-slate-900">Import danh mục VT-TB</h2>
    <p className="my-3 text-xs leading-5 text-slate-600">Thêm Mã đối tượng và Mã nhóm vào danh mục trước. Để trống cột Mã vật tư để máy chủ tự cấp mã; điền mã đúng cấu trúc nếu cần giữ mã có sẵn. Mỗi lượt tối đa 100 dòng, toàn bộ cùng thành công hoặc cùng hoàn tác.</p>
    <fieldset disabled={busy} className="space-y-3"><div className="flex flex-wrap gap-3"><button className="min-h-9 rounded-lg border px-4 py-2 text-sm font-semibold" onClick={template}>Tải file mẫu CSV</button><input aria-label="Chọn file nhập VT-TB" type="file" accept=".xlsx,.csv,.tsv,.txt" onChange={fileSelected} /></div>
      <label className="block text-xs font-semibold" htmlFor="part-import-text">Hoặc dán bảng từ Excel / nội dung CSV</label><textarea id="part-import-text" rows={5} className="w-full rounded-lg border p-3 text-xs" value={raw} onChange={event => { changed(); setRaw(event.target.value); }} />
      <button className="min-h-9 rounded-lg border px-4 py-2 text-sm font-semibold" onClick={() => { try { analyze(parseDelimited(raw)); } catch (failure) { setRows(null); setError((failure as Error).message); } }}>Phân tích và xem trước</button>
    </fieldset>
    {rows && <div className="my-4 max-h-64 overflow-auto rounded-lg border"><table className="w-full text-left text-xs"><thead className="bg-slate-50"><tr>{['Dòng', 'Loại', 'Đối tượng', 'Nhóm', 'Tên', 'Mã vật tư'].map(label => <th className="p-2" key={label}>{label}</th>)}</tr></thead><tbody>{rows.map((row, index) => <tr key={index} className="border-t"><td className="p-2">{index + 2}</td><td>{row.item_type}</td><td>{row.object_code}</td><td>{row.group_code}</td><td>{row.name}</td><td>{row.sku || 'Tự cấp khi lưu'}</td></tr>)}</tbody></table></div>}
    {error && <p role="alert" className="my-3 rounded bg-red-50 p-3 text-xs text-red-700">{error}</p>}
    <div className="mt-4 flex justify-end gap-2 border-t pt-4"><button disabled={busy} className="min-h-9 rounded-lg border px-4 py-2 text-sm font-semibold" onClick={onClose}>Đóng</button><button disabled={busy || !rows} className="min-h-9 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50" onClick={() => { void save(); }}>{busy ? 'Đang xử lý…' : `Nhập ${rows?.length ?? 0} dòng lên máy chủ`}</button></div>
  </div></div>;
}

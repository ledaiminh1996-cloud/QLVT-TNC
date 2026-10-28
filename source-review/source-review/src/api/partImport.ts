import { definitions } from './catalogFields.ts';

export function parseDelimited(text: string): string[][] {
  const source = text.replace(/^\uFEFF/, '');
  const first = source.split(/\r?\n/, 1)[0];
  const delimiter = first.includes('\t') ? '\t' : first.includes(';') && !first.includes(',') ? ';' : ',';
  const rows: string[][] = []; let cells: string[] = []; let value = ''; let quoted = false; let closed = false;
  for (let i = 0; i < source.length; i++) {
    const char = source[i];
    if (quoted) {
      if (char === '"' && source[i + 1] === '"') { value += '"'; i++; }
      else if (char === '"') { quoted = false; closed = true; }
      else value += char;
    } else if (char === '"' && !value && !closed) quoted = true;
    else if (char === delimiter) { cells.push(value); value = ''; closed = false; }
    else if (char === '\n' || char === '\r') {
      if (char === '\r' && source[i + 1] === '\n') i++;
      cells.push(value); if (cells.some(cell => cell.trim())) rows.push(cells);
      cells = []; value = ''; closed = false;
    } else {
      if (closed && !/\s/.test(char)) throw new Error('CSV có ký tự không hợp lệ sau dấu ngoặc kép.');
      if (!closed) value += char;
    }
  }
  if (quoted) throw new Error('CSV thiếu dấu ngoặc kép đóng.');
  cells.push(value); if (cells.some(cell => cell.trim())) rows.push(cells);
  return rows;
}

export function convertPartImport(table: unknown[][]): Record<string, string | number | null>[] {
  if (table.length < 2) throw new Error('Cần dòng tiêu đề và ít nhất một dòng dữ liệu.');
  const normalize = (text: unknown) => String(text ?? '').trim().toLocaleLowerCase('vi-VN');
  const headers = table[0].map(normalize);
  if (new Set(headers).size !== headers.length || headers.some(header => !header)) throw new Error('Tiêu đề cột không được trống hoặc trùng.');
  const aliases: Record<string, string> = {
    'tên vật tư': 'name', 'tên phụ tùng / vật tư': 'name', 'đvt': 'unit', 'nhóm kỹ thuật': 'category', 'nhóm danh mục': 'category', 'áp dụng cho': 'applicable_for', 'mã đối tượng': 'object_code', 'mã nhóm': 'group_code',
  };
  for (const field of definitions.parts.fields) { aliases[normalize(field.label)] = field.key; aliases[field.key] = field.key; }
  const keys = headers.map(header => { if (!aliases[header]) throw new Error(`Cột chưa hỗ trợ: ${header}. Hãy dùng file mẫu; tồn kho và giá vốn không nhập qua danh mục.`); return aliases[header]; });
  if (new Set(keys).size !== keys.length) throw new Error('Có hai cột cùng biểu diễn một trường dữ liệu.');
  const output: Record<string, string | number | null>[] = [];
  for (let index = 1; index < table.length; index++) {
    const cells = table[index];
    if (!cells.some(cell => String(cell ?? '').trim())) continue;
    if (cells.length > keys.length && cells.slice(keys.length).some(cell => String(cell ?? '').trim())) throw new Error(`Dòng ${index + 1}: số cột vượt quá tiêu đề.`);
    const values: Record<string, string | number | null> = { category: 'accessories', applicable_for: 'both' };
    keys.forEach((key, column) => { const value = String(cells[column] ?? '').trim(); if (value) values[key] = value; });
    const type = normalize(values.item_type ?? '').toUpperCase();
    values.item_type = ({ 'VẬT TƯ': 'M', 'DỊCH VỤ': 'G', 'THANH LÝ': 'T', 'HÀNG CŨ': 'C' } as Record<string, string>)[type] ?? type;
    for (const key of ['sku', 'object_code', 'group_code']) if (values[key]) values[key] = String(values[key]).toUpperCase();
    const code = String(values.sku ?? '').match(/^([MGTC])-([A-Z0-9]{1,20})-([A-Z0-9]{1,20})-([0-9]{4})$/);
    if (code) {
      if (!values.item_type) values.item_type = code[1];
      if (!values.object_code) values.object_code = code[2];
      if (!values.group_code) values.group_code = code[3];
    }
    if (!['M', 'G', 'T', 'C'].includes(String(values.item_type)) || !/^[A-Z0-9]{1,20}$/.test(String(values.object_code ?? '')) || !/^[A-Z0-9]{1,20}$/.test(String(values.group_code ?? '')) || !values.name || !values.unit) {
      throw new Error(`Dòng ${index + 1}: cần Loại hàng, Mã đối tượng, Mã nhóm, Tên vật tư và ĐVT hợp lệ.`);
    }
    if (values.sku && (!code || Number(code[4]) < 1 || `${code[1]}-${code[2]}-${code[3]}` !== `${values.item_type}-${values.object_code}-${values.group_code}`)) throw new Error(`Dòng ${index + 1}: mã vật tư không khớp các thành phần mã.`);
    for (const field of definitions.parts.fields) {
      const value = values[field.key];
      if (value == null) continue;
      if (field.key === 'category' || field.key === 'applicable_for') {
        const choice = field.choices?.find(([id, label]) => normalize(id) === normalize(value) || normalize(label) === normalize(value));
        if (!choice) throw new Error(`Dòng ${index + 1}: ${field.label} không hợp lệ.`);
        values[field.key] = choice[0];
      } else if (field.type === 'number') {
        const rawNumber = Number(value);
        const number = field.scale ? Math.round(rawNumber * field.scale) : rawNumber;
        if (!Number.isFinite(rawNumber) || (field.scale && Math.abs(rawNumber * field.scale - number) > 0.000001) || !Number.isSafeInteger(number) || number < (field.min ?? 0) || (field.choices && !field.choices.some(([id]) => Number(id) === number))) throw new Error(`Dòng ${index + 1}: ${field.label} không hợp lệ.`);
        values[field.key] = number;
      }
    }
    output.push(values);
  }
  if (!output.length || output.length > 100) throw new Error('Mỗi lượt nhập hỗ trợ từ 1 đến 100 dòng.');
  const explicit = output.filter(row => row.sku).map(row => row.sku);
  if (new Set(explicit).size !== explicit.length) throw new Error('File có mã vật tư trùng nhau.');
  return output;
}

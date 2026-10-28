import React, { useState } from 'react';
import { X, Upload, Check, AlertCircle, FileSpreadsheet, RefreshCw } from 'lucide-react';

interface DirectoryExcelImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  sampleFormat: string;
  onImportRows: (rows: Record<string, string>[]) => void;
}

export const DirectoryExcelImportModal: React.FC<DirectoryExcelImportModalProps> = ({
  isOpen,
  onClose,
  title,
  sampleFormat,
  onImportRows
}) => {
  if (!isOpen) return null;

  const [rawText, setRawText] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [parsedRows, setParsedRows] = useState<Record<string, string>[]>([]);

  const handleParse = () => {
    setErrorMsg('');
    if (!rawText.trim()) {
      setErrorMsg('Vui lòng dán dữ liệu hoặc tải file');
      return;
    }

    try {
      // Split lines
      const lines = rawText.trim().split('\n').map(l => l.trim()).filter(Boolean);
      if (lines.length < 2) {
        setErrorMsg('Dữ liệu cần có ít nhất 1 dòng tiêu đề cột và 1 dòng dữ liệu');
        return;
      }

      // Check separator (comma or tab)
      const firstLine = lines[0];
      const sep = firstLine.includes('\t') ? '\t' : (firstLine.includes(',') ? ',' : ';');

      const headers = lines[0].split(sep).map(h => h.trim().replace(/^"|"$/g, ''));
      const rows: Record<string, string>[] = [];

      for (let i = 1; i < lines.length; i++) {
        const parts = lines[i].split(sep).map(p => p.trim().replace(/^"|"$/g, ''));
        const rowObj: Record<string, string> = {};
        headers.forEach((h, hIdx) => {
          rowObj[h] = parts[hIdx] || '';
        });
        rows.push(rowObj);
      }

      setParsedRows(rows);
    } catch (e: any) {
      setErrorMsg(`Lỗi định dạng: ${e.message}`);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const content = event.target?.result as string;
        setRawText(content);
      };
      reader.readAsText(file, 'UTF-8');
    }
  };

  const handleConfirm = () => {
    if (parsedRows.length > 0) {
      onImportRows(parsedRows);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-sm overflow-y-auto">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden my-6">
        <div className="p-4 sm:p-5 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">
                Import Excel: {title}
              </h3>
              <p className="text-xs text-slate-400">
                Nhập danh sách từ file Excel / CSV hoặc copy-paste trực tiếp từ bảng tính
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-white rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 sm:p-6 space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-400">Chọn file .csv hoặc dán bảng:</span>
            <label className="px-3 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-lg text-xs font-semibold cursor-pointer">
              <span>Tải file CSV/Excel</span>
              <input type="file" accept=".csv,.txt" onChange={handleFileUpload} className="hidden" />
            </label>
          </div>

          <div>
            <textarea
              rows={6}
              value={rawText}
              onChange={(e) => {
                setRawText(e.target.value);
                setParsedRows([]);
              }}
              placeholder={`Mẫu định dạng:\n${sampleFormat}`}
              className="w-full p-3 bg-slate-950 border border-slate-800 rounded-xl text-xs font-sans text-slate-200 focus:outline-none focus:border-amber-500"
            />
          </div>

          <div className="flex justify-between items-center">
            <button
              type="button"
              onClick={handleParse}
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-amber-400 border border-slate-700 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1.5"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Phân Tích Bảng</span>
            </button>
            {parsedRows.length > 0 && (
              <span className="text-xs text-emerald-400 font-bold">
                ✓ Đã nhận diện {parsedRows.length} dòng dữ liệu hợp lệ
              </span>
            )}
          </div>

          {errorMsg && (
            <div className="p-3 bg-red-950/40 border border-red-800 rounded-xl text-xs text-red-300 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {parsedRows.length > 0 && (
            <div className="max-h-40 overflow-y-auto border border-slate-800 rounded-xl bg-slate-950 p-2 text-[11px] font-sans text-slate-300">
              <div className="font-bold text-amber-400 mb-1">Xem trước dòng đầu tiên:</div>
              <pre>{JSON.stringify(parsedRows[0], null, 2)}</pre>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-semibold"
            >
              Hủy
            </button>
            <button
              type="button"
              disabled={parsedRows.length === 0}
              onClick={handleConfirm}
              className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white font-bold rounded-lg text-xs shadow transition cursor-pointer"
            >
              Nhập {parsedRows.length} Dòng Vào Danh Mục
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

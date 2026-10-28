import React, { useState } from 'react';
import { X, Upload, Check, AlertCircle, FileText, Database, RefreshCw } from 'lucide-react';
import { Vehicle, InventoryTransaction, SparePart } from '../types/inventory';
import { parseDateVN, extractTrailerAndDriver } from '../utils/rawProjectParser';
import { DIESEL_PRICE_PER_LITER } from '../data/userFleetProjectData';

interface ProjectDataImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImportData: (newVehicles: Vehicle[], newTxs: InventoryTransaction[], fuelPart: SparePart) => void;
}

export const ProjectDataImportModal: React.FC<ProjectDataImportModalProps> = ({
  isOpen,
  onClose,
  onImportData
}) => {
  if (!isOpen) return null;

  const [rawText, setRawText] = useState('');
  const [parseStatus, setParseStatus] = useState<{
    success: boolean;
    txCount: number;
    tractorCount: number;
    trailerCount: number;
    totalLiters: number;
    error?: string;
  } | null>(null);

  const handleAnalyze = () => {
    if (!rawText.trim()) return;

    try {
      let txCount = 0;
      let totalLiters = 0;
      const tractors = new Set<string>();
      const trailers = new Set<string>();

      const lines = rawText.split('\n');
      
      lines.forEach(line => {
        const jsonMatch = line.match(/\{.*"lines":\s*\[.*\]/);
        let jsonStr = '';

        if (jsonMatch) {
          jsonStr = jsonMatch[0];
        } else if (line.trim().startsWith('{') && line.trim().endsWith('}')) {
          jsonStr = line.trim();
        }

        if (jsonStr.includes('""')) {
          jsonStr = jsonStr.replace(/""/g, '"');
        }

        if (jsonStr) {
          try {
            const batch = JSON.parse(jsonStr);
            if (batch.lines && Array.isArray(batch.lines)) {
              batch.lines.forEach((l: any) => {
                if (l.form && l.form.items) {
                  txCount++;
                  const firstItem = l.form.items[0];
                  if (firstItem.phuongTien) {
                    const plate = firstItem.phuongTien.trim().replace(/^TN-|^TN-MP-/, '');
                    if (plate) tractors.add(plate);
                  }
                  if (firstItem.soLuong) {
                    totalLiters += Number(firstItem.soLuong) || 0;
                  }
                  const info = extractTrailerAndDriver(l.form.dienGiai || '');
                  if (info.trailer) {
                    trailers.add(info.trailer);
                  }
                }
              });
            }
          } catch {
            // continue
          }
        }
      });

      if (txCount === 0) {
        setParseStatus({
          success: false,
          txCount: 0,
          tractorCount: 0,
          trailerCount: 0,
          totalLiters: 0,
          error: 'Không tìm thấy cấu trúc dữ liệu JSON hợp lệ. Hãy kiểm tra định dạng dữ liệu.'
        });
      } else {
        setParseStatus({
          success: true,
          txCount,
          tractorCount: tractors.size,
          trailerCount: trailers.size,
          totalLiters
        });
      }
    } catch (err: any) {
      setParseStatus({
        success: false,
        txCount: 0,
        tractorCount: 0,
        trailerCount: 0,
        totalLiters: 0,
        error: `Lỗi phân tích: ${err.message}`
      });
    }
  };

  const handleExecuteImport = () => {
    if (!parseStatus?.success) return;

    const vehicleMap = new Map<string, Vehicle>();
    const newTxs: InventoryTransaction[] = [];
    let totalLiters = 0;

    const lines = rawText.split('\n');
    lines.forEach(line => {
      const jsonMatch = line.match(/\{.*"lines":\s*\[.*\]/);
      let jsonStr = jsonMatch ? jsonMatch[0] : (line.trim().startsWith('{') ? line.trim() : '');
      if (jsonStr.includes('""')) {
        jsonStr = jsonStr.replace(/""/g, '"');
      }

      if (jsonStr) {
        try {
          const batch = JSON.parse(jsonStr);
          if (batch.lines && Array.isArray(batch.lines)) {
            batch.lines.forEach((l: any) => {
              if (l.form && l.form.items) {
                const recDate = parseDateVN(l.form.ngay);
                const info = extractTrailerAndDriver(l.form.dienGiai || '');
                const firstItem = l.form.items[0];
                const tractorPlate = firstItem.phuongTien.trim().replace(/^TN-|^TN-MP-/, '');
                const driver = firstItem.tenTaiXe || info.driver || 'Tài xế';
                const odo = firstItem.odoLap && firstItem.odoLap > 1000 ? firstItem.odoLap : 650;

                // Tractor
                if (tractorPlate && !vehicleMap.has(tractorPlate)) {
                  vehicleMap.set(tractorPlate, {
                    id: `veh-${tractorPlate.replace(/[^a-zA-Z0-9]/g, '')}`,
                    plateNumber: tractorPlate,
                    type: 'tractor',
                    brandModel: 'Xe Đầu Kéo Container Đường Dài',
                    manufactureYear: 2022,
                    currentOdoKm: odo,
                    assignedDriver: driver,
                    status: 'active'
                  });
                }

                // Trailer
                if (info.trailer && !vehicleMap.has(info.trailer)) {
                  vehicleMap.set(info.trailer, {
                    id: `veh-${info.trailer.replace(/[^a-zA-Z0-9]/g, '')}`,
                    plateNumber: info.trailer,
                    type: 'trailer',
                    brandModel: info.isReefer ? 'Rơ-Moóc Lạnh (Container Lạnh)' : 'Rơ-Moóc Xương 40ft/45ft',
                    manufactureYear: 2023,
                    currentOdoKm: odo,
                    assignedDriver: `Đi kèm xe ${tractorPlate}`,
                    status: 'active'
                  });
                }

                const subtotal = (firstItem.soLuong || 0) * DIESEL_PRICE_PER_LITER;
                totalLiters += firstItem.soLuong || 0;

                const tx: InventoryTransaction = {
                  id: `tx-import-${l.receipt || Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
                  code: l.receipt || `PX-${Date.now()}`,
                  type: 'OUT',
                  date: recDate,
                  creatorName: batch.authorName || 'Nguyễn Thị Thuý',
                  partnerOrReceiver: driver,
                  invoiceNumber: firstItem.bonDau || 'Bồn Dầu Trung Tâm',
                  items: [
                    {
                      partId: 'part-diesel-0020',
                      sku: firstItem.ma || 'M-DC-TIEU-0020',
                      partName: info.isReefer ? 'Dầu DO (Cấp Máy Lạnh Rơ-Moóc)' : 'Dầu DO (Cấp Động Cơ Đầu Kéo)',
                      unit: 'Lít',
                      quantity: firstItem.soLuong || 0,
                      unitPrice: DIESEL_PRICE_PER_LITER,
                      totalPrice: subtotal,
                      vehicleId: `veh-${tractorPlate.replace(/[^a-zA-Z0-9]/g, '')}`,
                      vehiclePlate: tractorPlate,
                      vehicleOdoAtMount: odo,
                      mountPosition: info.isReefer ? `Máy Lạnh Moóc ${info.trailer || ''}` : `Bình Dầu (${firstItem.bonDau || 'Bồn Trung Tâm'})`
                    }
                  ],
                  totalAmount: subtotal,
                  note: l.form.dienGiai || 'Cấp dầu DO',
                  createdAt: l.createdAt || new Date().toISOString()
                };

                newTxs.push(tx);
              }
            });
          }
        } catch {
          // ignore
        }
      }
    });

    const fuelPart: SparePart = {
      id: 'part-diesel-0020',
      sku: 'M-DC-TIEU-0020',
      name: 'Dầu DO 0.05S-II (Nhiên Liệu Động Cơ & Máy Lạnh)',
      category: 'lubricants',
      unit: 'Lít',
      specifications: 'Nhiên liệu Diesel tiêu chuẩn Euro 5 cấp bồn trung tâm (Bồn 1 & Bồn 2)',
      applicableFor: 'both',
      minStock: 8000,
      currentStock: Math.max(10000, 45000 - totalLiters),
      avgCostPrice: DIESEL_PRICE_PER_LITER,
      storageLocation: 'Kho Trung Tâm (Bồn 1 & Bồn 2)',
      lifespanKmLimit: 1000,
      lifespanDaysLimit: 7,
      notes: 'Theo dõi cấp phát dầu cho xe đầu kéo và máy lạnh rơ-moóc đường dài'
    };

    onImportData(Array.from(vehicleMap.values()), newTxs, fuelPart);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/50 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-3xl shadow-2xl overflow-hidden my-6">
        <div className="p-4 sm:p-5 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">
                Nhập Dữ Liệu Dự Án Thực Tế (CSV / JSON Import)
              </h3>
              <p className="text-xs text-slate-500">
                Tự động đồng bộ hóa toàn bộ phiếu xuất dầu PX, danh sách xe đầu kéo, rơ-moóc và tài xế
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-200 transition cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 sm:p-6 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Dán nội dung CSV hoặc JSON từ hệ thống quản lý xuất kho:
            </label>
            <textarea
              rows={8}
              value={rawText}
              onChange={(e) => {
                setRawText(e.target.value);
                setParseStatus(null);
              }}
              placeholder={`Dán văn bản định dạng:
ID,PHIÊN BẢN,TRẠNG THÁI,NGƯỜI TẠO,BỘ PHẬN,LOẠI,NGÀY TẠO,CẬP NHẬT,NỘI DUNG JSON
ID-498ba023-124d-48af-ae1a-886d0b8563ad,109,Hoàn thành,ledaiminh1996@gmail.com,,Xuất dầu,2026-10-14...`}
              className="w-full p-3 bg-white border border-slate-300 rounded-xl text-xs font-sans text-slate-800 placeholder-slate-400 focus:outline-none focus:border-amber-500 shadow-xs"
            />
          </div>

          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={handleAnalyze}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-300 rounded-lg text-xs font-bold transition cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Phân Tích Dữ Liệu</span>
            </button>
          </div>

          {parseStatus && (
            <div className={`p-4 rounded-xl border text-xs ${
              parseStatus.success ? 'bg-emerald-50 border-emerald-300 text-emerald-800' : 'bg-red-50 border-red-300 text-red-700'
            }`}>
              {parseStatus.success ? (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 font-bold text-sm text-emerald-700">
                    <Check className="w-4 h-4" />
                    <span>Phân tích thành công {parseStatus.txCount} phiếu xuất kho!</span>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 font-sans tabular-nums text-right text-[11px] text-slate-700">
                    <div>Tổng số phiếu: <strong>{parseStatus.txCount}</strong></div>
                    <div>Xe đầu kéo: <strong>{parseStatus.tractorCount}</strong></div>
                    <div>Rơ-moóc: <strong>{parseStatus.trailerCount}</strong></div>
                    <div>Tổng dầu DO: <strong>{parseStatus.totalLiters.toLocaleString('vi-VN')} Lít</strong></div>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0" />
                  <span>{parseStatus.error}</span>
                </div>
              )}
            </div>
          )}

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold border border-slate-200 cursor-pointer"
            >
              Đóng
            </button>
            <button
              type="button"
              disabled={!parseStatus?.success}
              onClick={handleExecuteImport}
              className="px-5 py-2 bg-amber-500 hover:bg-amber-600 disabled:opacity-40 disabled:cursor-not-allowed text-slate-950 font-bold rounded-lg text-xs transition shadow-xs cursor-pointer"
            >
              Nạp Vào Hệ Thống
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

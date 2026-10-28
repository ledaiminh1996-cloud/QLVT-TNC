import { useEffect, useState } from "react";
import type { DocumentClient } from "./documentClient";
export function PartStock({
  partId,
  warehouseId,
  documents,
  excludeDocument,
  stockState,
  label = "Tồn kho trước phiếu này",
}: {
  partId: string;
  warehouseId: string;
  documents: DocumentClient;
  excludeDocument?: string;
  stockState?: string;
  label?: string;
}) {
  const [quantity, setQuantity] = useState<number>(),
    [error, setError] = useState(false),
    [known, setKnown] = useState(true),
    [revision, setRevision] = useState(0);
  useEffect(() => {
    setQuantity(undefined);
    setError(false);
    setKnown(true);
    if (!partId || !warehouseId) return;
    const controller = new AbortController();
    documents
      .stock(
        partId,
        warehouseId,
        controller.signal,
        excludeDocument,
        stockState,
      )
      .then((result) => {
        if (!controller.signal.aborted) {
          setKnown(result.quantity_known !== false);
          setQuantity(result.quantity_milli / 1000);
        }
      })
      .catch(() => {
        if (!controller.signal.aborted) setError(true);
      });
    return () => controller.abort();
  }, [partId, warehouseId, documents, excludeDocument, stockState, revision]);
  return (
    <span>
      {label}:{" "}
      {error ? (
        <span role="alert">
          Không tải được{" "}
          <button
            type="button"
            className="underline"
            onClick={() => setRevision((n) => n + 1)}
          >
            Thử lại tồn kho
          </button>
        </span>
      ) : !warehouseId ? (
        "Chọn kho"
      ) : !known ? (
        "Chưa có số liệu trước phiếu"
      ) : quantity === undefined ? (
        partId ? (
          "Đang tải…"
        ) : (
          "Chọn vật tư"
        )
      ) : (
        new Intl.NumberFormat("vi-VN", {
          maximumFractionDigits: 3,
        }).format(quantity)
      )}
    </span>
  );
}

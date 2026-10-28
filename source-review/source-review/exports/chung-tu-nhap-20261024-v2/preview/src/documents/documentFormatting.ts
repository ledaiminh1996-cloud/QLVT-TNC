export const money = (value: number | null) =>
  value === null
    ? "—"
    : new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 0 }).format(
        value,
      ) + " đ";

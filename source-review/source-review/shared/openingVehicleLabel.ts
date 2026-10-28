export function openingVehicleLabel(row: Record<string, unknown>): string {
  const types: Record<string,string> = {tractor:"Đầu kéo",trailer:"Rơ moóc",office_car:"Xe văn phòng",rented_truck:"Xe tải"};
  return String(row.plate_number ?? "") + " — " + (types[String(row.type)] ?? String(row.brand_model ?? "Phương tiện"));
}


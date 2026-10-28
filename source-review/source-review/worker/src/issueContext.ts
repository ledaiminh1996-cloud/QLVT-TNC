import type { Env, Row } from "./types.ts";
import { ApiError } from "./http.ts";
import {
  emptyIssueDetails,
  issueVehicleGroup,
} from "../../shared/issueDetails.ts";
export async function issueContext(
  env: Env,
  staffId: string,
  vehicleId: string,
  driverId: string,
) {
  const result = emptyIssueDetails();
  let recipient = "";
  if (staffId) {
    const s = await env.DB.prepare("SELECT * FROM staff WHERE id=?")
      .bind(staffId)
      .first<Row>();
    if (!s || s.is_active !== 1)
      throw new ApiError(
        400,
        "VALIDATION_ERROR",
        "Người nhận không còn hoạt động.",
      );
    result.recipient_staff_id = staffId;
    recipient = String(s.name);
    result.department_id = String(s.department_id ?? "");
    if (result.department_id) {
      const d = await env.DB.prepare("SELECT name FROM departments WHERE id=?")
        .bind(result.department_id)
        .first<Row>();
      result.department_name = String(d?.name ?? s.department ?? "");
    } else result.department_name = String(s.department ?? "");

  }
  if(driverId&&!vehicleId){
    const matches=await env.DB.prepare("SELECT id FROM vehicles WHERE assigned_driver_id=? AND status='active' AND type<>'trailer' ORDER BY id LIMIT 2").bind(driverId).all<Row>();
    if(matches.results.length===1)vehicleId=String(matches.results[0].id);
    else if(matches.results.length===0){const staff=await env.DB.prepare("SELECT vehicle_plate FROM staff WHERE id=?").bind(driverId).first<Row>();if(staff?.vehicle_plate){const vehicle=await env.DB.prepare("SELECT id FROM vehicles WHERE plate_number=? AND status='active' AND type<>'trailer'").bind(staff.vehicle_plate).first<Row>();if(vehicle)vehicleId=String(vehicle.id)}}
  }
  if (vehicleId) {
    const v = await env.DB.prepare("SELECT * FROM vehicles WHERE id=?")
      .bind(vehicleId)
      .first<Row>();
    if (!v || v.status !== "active" || v.type === "trailer")
      throw new ApiError(
        400,
        "VALIDATION_ERROR",
        "Chọn biển số phương tiện đang hoạt động.",
      );
    result.vehicle_id = vehicleId;
    result.vehicle_plate = String(v.plate_number);
    result.vehicle_group = issueVehicleGroup({
      route_group: v.route_group,
      source_group: v.source_group,
      type: v.type,
    });
    result.odo = String(v.current_odo_km ?? 0);
    if (!driverId) driverId = String(v.assigned_driver_id ?? "");
    const links = await env.DB.prepare(
      "SELECT pairing_type,child_code FROM equipment_pairing_drafts WHERE parent_code=? AND is_active=1 AND pairing_type IN ('trailer','generator','container') ORDER BY id",
    )
      .bind(v.plate_number)
      .all<Row>();
    for (const type of ["trailer", "generator", "container"]) {
      const matches = links.results.filter((l) => l.pairing_type === type);
      if (matches.length === 1)
        result[type === "trailer" ? "trailer_number" : type === "generator" ? "other" : "container_number"] =
          String(matches[0].child_code);
    }
  }
  if (driverId) {
    const driver = await env.DB.prepare(
      "SELECT name,staff_type,is_active FROM staff WHERE id=?",
    )
      .bind(driverId)
      .first<Row>();
    if (!driver || driver.is_active !== 1 || driver.staff_type !== "driver")
      throw new ApiError(
        400,
        "VALIDATION_ERROR",
        "Chọn lái xe đang hoạt động trong danh mục tài xế.",
      );
    result.driver_id = driverId;
    result.driver_name = String(driver.name);
  }
  return { ...result, recipient };
}

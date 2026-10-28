import type {Env,User} from "./types.ts";
import {ApiError} from "./http.ts";
/** Mounted opening sources follow creator access; warehouse-origin issues retain warehouse permissions. */
export const sourceAccessSql=(line="l",opening="ou")=>`((${opening}.inventory_line_id IS NOT NULL AND EXISTS(SELECT 1 FROM inventory_documents origin WHERE origin.id=${line}.document_id AND origin.created_by=?)) OR (EXISTS(SELECT 1 FROM document_warehouse_access wa WHERE wa.user_id=? AND wa.warehouse_id=${line}.from_warehouse_id)))`;
export async function checkSourceAccess(env:Env,user:User,rootId:string){if(user.role!=="warehouse")return;const allowed=await env.DB.prepare("SELECT 1 FROM inventory_document_lines l LEFT JOIN opening_usage_lines ou ON ou.inventory_line_id=l.id WHERE l.id=? AND "+sourceAccessSql()).bind(rootId,user.id,user.id).first();if(!allowed)throw new ApiError(403,"SOURCE_SCOPE","Nguồn đầu kỳ không thuộc tài khoản hoặc kho xuất chưa được cấp quyền.");}

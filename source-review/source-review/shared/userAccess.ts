export const userRoles = {
  admin: "Quản trị", accountant: "Kế toán", warehouse: "Thủ kho", viewer: "Chỉ xem",
} as const;
export type UserRole = keyof typeof userRoles;
export const roleDescriptions: Record<UserRole,string> = {
  admin: "Quản lý người dùng, phân quyền và toàn bộ kho; cấu hình hệ thống.",
  accountant: "Quản lý danh mục và chứng từ trên toàn bộ kho; không quản lý tài khoản.",
  warehouse: "Lập chứng từ tại kho được cấp; theo dõi vật tư đầu kỳ đang sử dụng do mình khai báo.",
  viewer: "Xem dữ liệu toàn bộ kho; không lập hoặc sửa chứng từ, danh mục.",
};
export interface ManagedUser {
 id:string; version:number; email:string; display_name:string; role:UserRole;
 password_set?:0|1;
 is_active:0|1; access_linked:0|1; access_linked_at:string|null;
 units?:Array<{id:string;code:string;name:string;is_active:number}>;
 warehouses:Array<{id:string;code:string;name:string;is_active:number}>;
}
export interface UserAccessInput { email:string;display_name:string;role:UserRole;is_active:0|1;warehouse_ids:string[];unit_ids?:string[];initial_password?:string;version?:number }
export interface UserAccessPage {data:ManagedUser[];pagination:{page:number;page_size:number;total:number}}

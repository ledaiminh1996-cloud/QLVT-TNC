export interface Env {
  DB: D1Database;
  AUTH_MODE?: "native"|"access";
  AUTH_PASSWORD_PEPPER?: string;
  ACCESS_TEAM_DOMAIN: string;
  ACCESS_AUD: string;
  ASSETS?: Fetcher;
}

export type Role = 'admin' | 'accountant' | 'warehouse' | 'viewer';
export interface Identity { subject: string; email: string }
export interface User {
  id: string;
  auth_subject: string;
  email: string;
  display_name: string;
  role: Role;
  is_active: number;
  version: number;
}
export type Row = Record<string, string | number | null>;

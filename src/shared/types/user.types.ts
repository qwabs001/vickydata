export type UserRole = "CUSTOMER" | "AGENT" | "ADMIN";
export type UserStatus = "ACTIVE" | "SUSPENDED" | "DELETED";

export interface User {
  id: string;
  phoneNumber: string;
  fullName?: string | null;
  role: UserRole;
  status: UserStatus;
  profileImage?: string | null;
  country?: string | null;
  createdAt: string;
  updatedAt: string;
}

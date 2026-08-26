import { getCurrentUser } from "./useGlobal";

export type ArchiveRole = "admin" | "data_entry" | "viewer";

export function getArchivePermissions() {
  const currentRole = getCurrentUser()?.role;
  const role: ArchiveRole =
    currentRole === "admin"
      ? "admin"
      : currentRole === "viewer"
        ? "viewer"
        : "data_entry";

  return {
    role,
    canEdit: role === "admin" || role === "data_entry",
    canDelete: role === "admin",
    canManageUsers: role === "admin",
    canAccessHR: role === "admin" || getCurrentUser()?.hrAccess === true,
  };
}
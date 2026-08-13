import { useContext } from "react";
import { AuthContext } from "./auth-context";
import type { RoleUtilisateur } from "./auth-context";
import { rolesEffectifs } from "@/shared/lib/roles";

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  const effectifs = rolesEffectifs(ctx.user?.roles ?? []);
  const hasRole = (role: RoleUtilisateur): boolean => effectifs.has(role);
  const hasAnyRole = (roles: RoleUtilisateur[]): boolean => roles.some((r) => effectifs.has(r));
  return { ...ctx, hasRole, hasAnyRole };
}

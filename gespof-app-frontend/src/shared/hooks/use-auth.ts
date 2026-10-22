import { useContext } from "react";
import { AuthContext } from "./auth-context";
import type { RoleUtilisateur } from "./auth-context";
import { rolesEffectifs } from "@/shared/lib/roles";
import type { Acces } from "@/shared/lib/acces";

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  const effectifs = rolesEffectifs(ctx.user?.roles ?? []);
  const hasRole = (role: RoleUtilisateur): boolean => effectifs.has(role);
  const hasAnyRole = (roles: RoleUtilisateur[]): boolean => roles.some((r) => effectifs.has(r));
  const accesEffectifs = new Set(ctx.user?.acces ?? []);
  /** Accès fin autorisé pour l'utilisateur connecté (voir shared/lib/acces.ts). */
  const hasAcces = (acces: Acces): boolean => accesEffectifs.has(acces);
  return { ...ctx, hasRole, hasAnyRole, hasAcces };
}

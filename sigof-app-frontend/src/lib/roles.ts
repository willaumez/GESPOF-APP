import type { RoleUtilisateur } from "@/contexts/auth-context";

const HIERARCHIE_ROLES: Partial<Record<RoleUtilisateur, RoleUtilisateur[]>> = {
  CHEF_SOF: ["AGENT_SOF"],
  CHEF_SP: ["AGENT_SP"],
  CHEF_SR: ["AGENT_SR"],
  DIRECTEUR_DOMF: ["AGENT_SOF", "AGENT_SP", "AGENT_SR"],
  ADMINISTRATEUR: ["CHEF_SOF", "CHEF_SP", "CHEF_SR", "DIRECTEUR_DOMF", "DIRECTION_DG", "SUPERVISEUR"],
};

export function rolesEffectifs(roles: RoleUtilisateur[]): Set<RoleUtilisateur> {
  const resultat = new Set<RoleUtilisateur>();
  const pile = [...roles];
  while (pile.length > 0) {
    const role = pile.pop();
    if (!role || resultat.has(role)) continue;
    resultat.add(role);
    for (const implique of HIERARCHIE_ROLES[role] ?? []) pile.push(implique);
  }
  return resultat;
}

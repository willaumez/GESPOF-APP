/**
 * Catalogue metier -> portail + actions autorisees, miroir cote client de
 * RoleAcces::portail()/actions() (sigof-app-backend/src/Shared/Enum/RoleAcces.php).
 * Utilise uniquement pour l'UX (aperçu instantane, filtrage du <Select> metier) ;
 * le backend reste la seule source de verite appliquee a l'ecriture.
 */
import type { Portail, RoleUtilisateur } from "@/shared/hooks/auth-context";

export type ActionAutorisee = "CONSULTER" | "AJOUTER" | "MODIFIER" | "SUPPRIMER";

export interface MetierInfo {
  metier: RoleUtilisateur;
  libelle: string;
  portail: Portail | null;
  actions: ActionAutorisee[];
}

const ACTIONS_CHEF: ActionAutorisee[] = ["CONSULTER", "AJOUTER", "MODIFIER", "SUPPRIMER"];
const ACTIONS_AGENT: ActionAutorisee[] = ["CONSULTER", "AJOUTER", "MODIFIER"];
const ACTIONS_TRANSVERSE: ActionAutorisee[] = ["CONSULTER"];

const METIERS: Record<RoleUtilisateur, MetierInfo> = {
  ADMINISTRATEUR: { metier: "ADMINISTRATEUR", libelle: "Administrateur", portail: "admin", actions: ACTIONS_CHEF },
  AGENT_SOF: { metier: "AGENT_SOF", libelle: "Agent du Service des Opérations Financières", portail: "sof", actions: ACTIONS_AGENT },
  CHEF_SOF: { metier: "CHEF_SOF", libelle: "Chef du Service des Opérations Financières", portail: "sof", actions: ACTIONS_CHEF },
  AGENT_SP: { metier: "AGENT_SP", libelle: "Agent du Service de Prévision", portail: "sp", actions: ACTIONS_AGENT },
  CHEF_SP: { metier: "CHEF_SP", libelle: "Chef du Service de Prévision", portail: "sp", actions: ACTIONS_CHEF },
  AGENT_SR: { metier: "AGENT_SR", libelle: "Agent du Service Règlement", portail: "sr", actions: ACTIONS_AGENT },
  CHEF_SR: { metier: "CHEF_SR", libelle: "Chef du Service Règlement", portail: "sr", actions: ACTIONS_CHEF },
  DIRECTEUR_DOMF: { metier: "DIRECTEUR_DOMF", libelle: "Directeur de la Direction des Opérations Monétaires et Financières", portail: null, actions: ACTIONS_TRANSVERSE },
  DIRECTION_DG: { metier: "DIRECTION_DG", libelle: "Direction Générale", portail: null, actions: ACTIONS_TRANSVERSE },
  SUPERVISEUR: { metier: "SUPERVISEUR", libelle: "Superviseur", portail: null, actions: ACTIONS_TRANSVERSE },
};

export function infoMetier(metier: RoleUtilisateur): MetierInfo {
  return METIERS[metier];
}

export function tousLesMetiers(): MetierInfo[] {
  return Object.values(METIERS);
}

const LIBELLE_GROUPE: Record<Portail | "transverse", string> = {
  sof: "SOF",
  sp: "SP",
  sr: "SR",
  admin: "Administration",
  transverse: "Transverse",
};

/** Métiers groupés par portail, pour un <Select> groupé — ne renvoie que les groupes non vides. */
export function grouperMetiers(metiers: MetierInfo[]): { groupe: string; metiers: MetierInfo[] }[] {
  const parGroupe: Record<Portail | "transverse", MetierInfo[]> = {
    sof: [], sp: [], sr: [], admin: [], transverse: [],
  };
  for (const info of metiers) {
    parGroupe[info.portail ?? "transverse"].push(info);
  }
  return (Object.keys(LIBELLE_GROUPE) as (Portail | "transverse")[])
    .map((cle) => ({ groupe: LIBELLE_GROUPE[cle], metiers: parGroupe[cle] }))
    .filter((g) => g.metiers.length > 0);
}

/**
 * Métiers que l'utilisateur connecté peut assigner à un tiers : un
 * ADMINISTRATEUR peut tout assigner ; un métier "chef" (action SUPPRIMER)
 * peut assigner les métiers de son propre portail ; un agent ou un métier
 * transverse ne peut en assigner aucun — même règle que
 * UtilisateurService::rolesGerablesPar() côté backend.
 */
export function metiersAssignablesPar(rolesConnecte: RoleUtilisateur[]): MetierInfo[] {
  if (rolesConnecte.includes("ADMINISTRATEUR")) {
    return tousLesMetiers();
  }

  const portailsGeres = new Set(
    rolesConnecte
      .map((r) => METIERS[r])
      .filter((info): info is MetierInfo & { portail: Portail } => info.portail !== null && info.actions.includes("SUPPRIMER"))
      .map((info) => info.portail),
  );

  return tousLesMetiers().filter((info) => info.portail !== null && portailsGeres.has(info.portail));
}

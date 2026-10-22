/**
 * Catalogue metier -> portail + actions autorisees, miroir cote client de
 * RoleAcces::portail()/actions()/accesRole() (gespof-app-backend/src/Shared/Enum/RoleAcces.php).
 * Utilise uniquement pour l'UX (aperçu instantane, filtrage du <Select> metier,
 * checklist d'habilitations individuelles) ; le backend reste la seule source
 * de verite appliquee a l'ecriture.
 */
import type { Portail, RoleUtilisateur } from "@/shared/hooks/auth-context";
import type { Acces } from "@/shared/lib/acces";

export type ActionAutorisee = "CONSULTER" | "AJOUTER" | "MODIFIER" | "SUPPRIMER";

export interface MetierInfo {
  metier: RoleUtilisateur;
  libelle: string;
  portail: Portail | null;
  actions: ActionAutorisee[];
  /** Catalogue des accès fins accordés par défaut à ce métier (miroir de RoleAcces::accesRole()). */
  accesParDefaut: Acces[];
}

const ACTIONS_CHEF: ActionAutorisee[] = ["CONSULTER", "AJOUTER", "MODIFIER", "SUPPRIMER"];
const ACTIONS_AGENT: ActionAutorisee[] = ["CONSULTER", "AJOUTER", "MODIFIER"];
const ACTIONS_TRANSVERSE: ActionAutorisee[] = ["CONSULTER"];

// Miroir de RoleAcces::ACCES_SR_AGENT / ACCES_SR_CHEF_SUPPLEMENTAIRES / ACCES_UTILISATEURS / ACCES_LECTURE_TRANSVERSE.
const ACCES_SR_AGENT: Acces[] = [
  "CONSULTER_TABLEAU_BORD_SR", "GENERER_FICHE_DEPOT", "CONSULTER_FICHE_DEPOT",
  "TELECHARGER_FICHE_DEPOT", "GERER_MOUVEMENT_FICHE", "CONSULTER_HISTORIQUE",
];
const ACCES_SR_CHEF_SUPPLEMENTAIRES: Acces[] = [
  "VALIDER_FICHE_DEPOT", "SUPPRIMER_FICHE_DEPOT", "SUPPRIMER_HISTORIQUE",
];
const ACCES_UTILISATEURS: Acces[] = [
  "CONSULTER_UTILISATEURS", "CONSULTER_AUDIT_CONNEXIONS", "CONSULTER_AUDIT_ACTIONS",
  "CREER_UTILISATEUR", "MODIFIER_UTILISATEUR",
  "DESACTIVER_REACTIVER_UTILISATEUR", "REINITIALISER_MOT_DE_PASSE_UTILISATEUR", "SUPPRIMER_UTILISATEUR",
];
const ACCES_LECTURE_TRANSVERSE: Acces[] = [
  "CONSULTER_TABLEAU_BORD_SR", "CONSULTER_FICHE_DEPOT", "TELECHARGER_FICHE_DEPOT",
  "CONSULTER_HISTORIQUE", "CONSULTER_UTILISATEURS",
];
const ACCES_SR_CHEF: Acces[] = [...ACCES_SR_AGENT, ...ACCES_SR_CHEF_SUPPLEMENTAIRES, ...ACCES_UTILISATEURS];

const METIERS: Record<RoleUtilisateur, MetierInfo> = {
  ADMINISTRATEUR: { metier: "ADMINISTRATEUR", libelle: "Administrateur", portail: "admin", actions: ACTIONS_CHEF, accesParDefaut: ACCES_SR_CHEF },
  AGENT_SOF: { metier: "AGENT_SOF", libelle: "Agent du Service des Opérations Financières", portail: "sof", actions: ACTIONS_AGENT, accesParDefaut: [] },
  CHEF_SOF: { metier: "CHEF_SOF", libelle: "Chef du Service des Opérations Financières", portail: "sof", actions: ACTIONS_CHEF, accesParDefaut: ACCES_UTILISATEURS },
  AGENT_SP: { metier: "AGENT_SP", libelle: "Agent du Service de Prévision", portail: "sp", actions: ACTIONS_AGENT, accesParDefaut: [] },
  CHEF_SP: { metier: "CHEF_SP", libelle: "Chef du Service de Prévision", portail: "sp", actions: ACTIONS_CHEF, accesParDefaut: ACCES_UTILISATEURS },
  AGENT_SR: { metier: "AGENT_SR", libelle: "Agent du Service Règlement", portail: "sr", actions: ACTIONS_AGENT, accesParDefaut: ACCES_SR_AGENT },
  CHEF_SR: { metier: "CHEF_SR", libelle: "Chef du Service Règlement", portail: "sr", actions: ACTIONS_CHEF, accesParDefaut: ACCES_SR_CHEF },
  DIRECTEUR_DOMF: { metier: "DIRECTEUR_DOMF", libelle: "Directeur de la Direction des Opérations Monétaires et Financières", portail: null, actions: ACTIONS_TRANSVERSE, accesParDefaut: ACCES_LECTURE_TRANSVERSE },
  DIRECTION_DG: { metier: "DIRECTION_DG", libelle: "Direction Générale", portail: null, actions: ACTIONS_TRANSVERSE, accesParDefaut: ACCES_LECTURE_TRANSVERSE },
  SUPERVISEUR: { metier: "SUPERVISEUR", libelle: "Superviseur", portail: null, actions: ACTIONS_TRANSVERSE, accesParDefaut: ACCES_LECTURE_TRANSVERSE },
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

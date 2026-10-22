import { requeteApi } from "@/shared/lib/api";
import { SERVICE_PREVISION_ENDPOINTS } from "./endpoints";
import type { FicheExecutionDetail } from "@/portails/Sp/types/fiche-execution.interface";

function urlFicheExecutionJournee(referenceJournee: string): string {
  return `${SERVICE_PREVISION_ENDPOINTS.JOURNEES_TRESORERIE}/${encodeURIComponent(referenceJournee)}/fiche-execution`;
}

/** Cherche une fiche déjà liée à la journée (fiche null si absente). */
export function trouverFicheExecutionJournee(
  referenceJournee: string,
): Promise<{ fiche: FicheExecutionDetail | null }> {
  return requeteApi<{ fiche: FicheExecutionDetail | null }>(
    urlFicheExecutionJournee(referenceJournee),
  );
}

/** Crée la fiche d'exécution depuis la Fiche Bleue (no-op si déjà liée). */
export function creerFicheExecutionJournee(
  referenceJournee: string,
): Promise<{ fiche: FicheExecutionDetail }> {
  return requeteApi<{ fiche: FicheExecutionDetail }>(
    urlFicheExecutionJournee(referenceJournee),
    { method: "POST" },
  );
}

export function detailFicheExecution(
  id: number,
): Promise<{ fiche: FicheExecutionDetail }> {
  return requeteApi<{ fiche: FicheExecutionDetail }>(
    `${SERVICE_PREVISION_ENDPOINTS.FICHES_EXECUTION}/${id}`,
  );
}

/** Applique des montants réalisés sur des feuilles ; le backend recalcule parents et écarts. */
export function appliquerMontantsRealise(
  id: number,
  montants: { section_id: number; montant_realise: string }[],
): Promise<{ fiche: FicheExecutionDetail }> {
  return requeteApi<{ fiche: FicheExecutionDetail }>(
    `${SERVICE_PREVISION_ENDPOINTS.FICHES_EXECUTION}/${id}/montants-realise`,
    {
      method: "PATCH",
      body: JSON.stringify({ montants }),
    },
  );
}

/** Ajoute une recette ou une dépense hors programmation (racine ou sous-section). */
export function ajouterSectionNonProgrammee(
  id: number,
  payload: {
    nom: string;
    type: "recette" | "depense";
    parent_id?: number | null;
    montant_realise?: string;
  },
): Promise<{ fiche: FicheExecutionDetail }> {
  return requeteApi<{ fiche: FicheExecutionDetail }>(
    `${SERVICE_PREVISION_ENDPOINTS.FICHES_EXECUTION}/${id}/sections`,
    {
      method: "POST",
      body: JSON.stringify(payload),
    },
  );
}

export function modifierSectionNonProgrammee(
  ficheId: number,
  sectionId: number,
  payload: { nom?: string; montant_realise?: string },
): Promise<{ fiche: FicheExecutionDetail }> {
  return requeteApi<{ fiche: FicheExecutionDetail }>(
    `${SERVICE_PREVISION_ENDPOINTS.FICHES_EXECUTION}/${ficheId}/sections/${sectionId}`,
    {
      method: "PATCH",
      body: JSON.stringify(payload),
    },
  );
}

export function supprimerSectionNonProgrammee(
  ficheId: number,
  sectionId: number,
): Promise<{ fiche: FicheExecutionDetail }> {
  return requeteApi<{ fiche: FicheExecutionDetail }>(
    `${SERVICE_PREVISION_ENDPOINTS.FICHES_EXECUTION}/${ficheId}/sections/${sectionId}`,
    { method: "DELETE" },
  );
}

export function reordonnerSectionsNonProgrammees(
  ficheId: number,
  ids: number[],
): Promise<{ fiche: FicheExecutionDetail }> {
  return requeteApi<{ fiche: FicheExecutionDetail }>(
    `${SERVICE_PREVISION_ENDPOINTS.FICHES_EXECUTION}/${ficheId}/sections/ordre`,
    {
      method: "PATCH",
      body: JSON.stringify({ ids }),
    },
  );
}

import { requeteApi } from "@/shared/lib/api";
import { SERVICE_PREVISION_ENDPOINTS } from "./endpoints";
import type { FicheExecutionDetail } from "@/portails/Sp/types/fiche-execution.interface";
import type { HistoriqueJournee } from "@/portails/Sp/types/journal-journee.interface";
import type {
  JourneeTresorerie,
  ListerJourneesParams,
  PageJourneesTresorerie,
  DepensesJourValidees,
  EtatDepensesJour,
  RecettesJourValidees,
  TypeRapprochement,
} from "@/portails/Sp/types/journee-tresorerie.interface";

const BASE = SERVICE_PREVISION_ENDPOINTS.JOURNEES_TRESORERIE;

export function creerJourneeTresorerie(): Promise<{ journee: JourneeTresorerie }> {
  return requeteApi<{ journee: JourneeTresorerie }>(BASE, { method: "POST" });
}

export function detailJourneeTresorerie(
  reference: string,
): Promise<{ journee: JourneeTresorerie }> {
  return requeteApi<{ journee: JourneeTresorerie }>(
    `${BASE}/${encodeURIComponent(reference)}`,
  );
}

export function derniereJourneeTresorerie(): Promise<{ journee: JourneeTresorerie | null }> {
  return requeteApi<{ journee: JourneeTresorerie | null }>(`${BASE}/derniere`);
}

/** Journée de trésorerie du jour calendaire (null si aucune). */
export function journeeTresorerieDuJour(): Promise<{ journee: JourneeTresorerie | null }> {
  return requeteApi<{ journee: JourneeTresorerie | null }>(`${BASE}/du-jour`);
}

/** Journée de trésorerie du jour calendaire donné (null si aucune). */
export function journeeTresorerieParDate(
  date: string,
): Promise<{ journee: JourneeTresorerie | null }> {
  const query = new URLSearchParams({ date });
  return requeteApi<{ journee: JourneeTresorerie | null }>(
    `${BASE}/par-date?${query.toString()}`,
  );
}

export function lierFicheBleueAJournee(
  referenceJournee: string,
  ficheBleueId: number,
): Promise<{ journee: JourneeTresorerie }> {
  return requeteApi<{ journee: JourneeTresorerie }>(
    `${BASE}/${encodeURIComponent(referenceJournee)}/fiche-bleue`,
    {
      method: "PATCH",
      body: JSON.stringify({ fiche_bleue_id: ficheBleueId }),
    },
  );
}

export function cloturerJourneeTresorerie(
  reference: string,
): Promise<{ journee: JourneeTresorerie }> {
  return requeteApi<{ journee: JourneeTresorerie }>(
    `${BASE}/${encodeURIComponent(reference)}/cloture`,
    { method: "POST" },
  );
}

/** Annule la clôture de la dernière journée (retire ses valeurs de la fiche consolidée). */
export function reouvrirJourneeTresorerie(
  reference: string,
): Promise<{ journee: JourneeTresorerie }> {
  return requeteApi<{ journee: JourneeTresorerie }>(
    `${BASE}/${encodeURIComponent(reference)}/reouverture`,
    { method: "POST" },
  );
}

export function demanderFicheDepotJournee(
  referenceJournee: string,
): Promise<{ envoye: boolean; deja_envoyee: boolean }> {
  return requeteApi<{ envoye: boolean; deja_envoyee: boolean }>(
    `${BASE}/${encodeURIComponent(referenceJournee)}/demander-fiche-depot`,
    { method: "POST" },
  );
}

export function listerJourneesTresorerie(
  params: ListerJourneesParams = {},
): Promise<PageJourneesTresorerie> {
  const query = new URLSearchParams();
  if (params.page) query.set("page", String(params.page));
  if (params.limite) query.set("limite", String(params.limite));
  if (params.date) query.set("date", params.date);
  if (params.q) query.set("q", params.q);
  if (params.etat) query.set("etat", params.etat);
  if (params.date_debut) query.set("date_debut", params.date_debut);
  if (params.date_fin) query.set("date_fin", params.date_fin);
  const suffixe = query.size > 0 ? `?${query.toString()}` : "";

  return requeteApi<PageJourneesTresorerie>(`${BASE}${suffixe}`);
}

/** Liste des recettes validée pour la journée (null si aucune). */
export function recettesJourValidees(
  reference: string,
): Promise<{ recettes_jour: RecettesJourValidees | null }> {
  return requeteApi<{ recettes_jour: RecettesJourValidees | null }>(
    `${BASE}/${encodeURIComponent(reference)}/recettes`,
  );
}

/** Fige les recettes Oracle de la date d'ouverture pour la journée (remplace l'existante). */
export function validerRecettesJour(
  reference: string,
  dateOuverture: string,
): Promise<{ recettes_jour: RecettesJourValidees }> {
  return requeteApi<{ recettes_jour: RecettesJourValidees }>(
    `${BASE}/${encodeURIComponent(reference)}/recettes`,
    {
      method: "PUT",
      body: JSON.stringify({ date_ouverture: dateOuverture }),
    },
  );
}

export function depensesJour(reference: string): Promise<EtatDepensesJour> {
  return requeteApi<EtatDepensesJour>(`${BASE}/${encodeURIComponent(reference)}/depenses`);
}

/**
 * Fusionne toutes les fiches de dépôt reçues pour la journée, sans doublon
 * (une fiche complémentaire n'ajoute que ses nouveaux éléments).
 */
export function validerDepensesJour(
  reference: string,
): Promise<{ depenses_jour: DepensesJourValidees; nouvelles: number }> {
  return requeteApi<{ depenses_jour: DepensesJourValidees; nouvelles: number }>(
    `${BASE}/${encodeURIComponent(reference)}/depenses`,
    { method: "PUT" },
  );
}

/** Ajoute la somme des éléments au réalisé de la rubrique (côté serveur). */
export function rapprocherElements<L>(
  reference: string,
  type: TypeRapprochement,
  cles: string[],
  sectionId: number,
): Promise<{ liste: L; fiche: FicheExecutionDetail }> {
  return requeteApi<{ liste: L; fiche: FicheExecutionDetail }>(
    `${BASE}/${encodeURIComponent(reference)}/rapprochements`,
    {
      method: "POST",
      body: JSON.stringify({ type, cles, section_id: sectionId }),
    },
  );
}

export function annulerRapprochement<L>(
  reference: string,
  type: TypeRapprochement,
  groupe: string,
): Promise<{ liste: L; fiche: FicheExecutionDetail }> {
  return requeteApi<{ liste: L; fiche: FicheExecutionDetail }>(
    `${BASE}/${encodeURIComponent(reference)}/rapprochements/annulation`,
    {
      method: "POST",
      body: JSON.stringify({ type, groupe }),
    },
  );
}

/** Audit journalier : qui a fait quoi dans la journée, de l'ouverture à la clôture. */
export function historiqueJournee(reference: string): Promise<HistoriqueJournee> {
  return requeteApi<HistoriqueJournee>(`${BASE}/${encodeURIComponent(reference)}/historique`);
}

export function supprimerJourneeTresorerie(reference: string): Promise<void> {
  return requeteApi<void>(`${BASE}/${encodeURIComponent(reference)}`, {
    method: "DELETE",
  });
}

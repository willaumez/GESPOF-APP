import { requeteApi } from "@/shared/lib/api";
import { SERVICE_OPERATIONS_ENDPOINTS } from "./endpoints";
import type {
  ExtractionDetailEtax,
  ExtractionRecettesPetrolieres,
  ExtractionRecettesPetrolieresDetail,
  ExtractionRecettesPetrolieresEtatParCompte,
} from "@/portails/Sof/types/recettes-petrolieres.interface";

const BASE = SERVICE_OPERATIONS_ENDPOINTS.RECETTES_PETROLIERES;

export function extraireRecettesPetrolieresOpBeac(
  dateDebut: string,
  dateFin: string,
): Promise<ExtractionRecettesPetrolieres> {
  const query = new URLSearchParams({
    date_debut: dateDebut,
    date_fin: dateFin,
  });
  return requeteApi(`${BASE}/extraction/op-beac?${query.toString()}`, {
    timeoutMs: 180_000,
  });
}

export function extraireRecettesPetrolieresEtatParCompte(
  dateDebut: string,
  dateFin: string,
): Promise<ExtractionRecettesPetrolieresEtatParCompte> {
  const query = new URLSearchParams({
    date_debut: dateDebut,
    date_fin: dateFin,
  });
  return requeteApi(`${BASE}/extraction/etat-par-compte?${query.toString()}`, {
    timeoutMs: 180_000,
  });
}

/** Cache navigateur : une même réf. E-TAX n’est demandée qu’une fois. */
const cacheDetailEtax = new Map<string, Promise<ExtractionDetailEtax>>();
const valeursDetailEtax = new Map<string, ExtractionDetailEtax>();

export function peekDetailEtax(refEtax: string): ExtractionDetailEtax | null {
  return valeursDetailEtax.get(refEtax.trim()) ?? null;
}

/** Alimente le cache local depuis l’extraction période (évite un appel Oracle au clic). */
export function injecterDetailsEtax(
  details: Record<string, ExtractionDetailEtax> | null | undefined,
): void {
  if (!details) return;
  for (const [refBrut, detail] of Object.entries(details)) {
    const ref = refBrut.trim();
    if (ref === "") continue;
    valeursDetailEtax.set(ref, detail);
    cacheDetailEtax.set(ref, Promise.resolve(detail));
  }
}

export function extraireDetailEtax(refEtax: string): Promise<ExtractionDetailEtax> {
  const ref = refEtax.trim();
  const enCours = cacheDetailEtax.get(ref);
  if (enCours) return enCours;

  const query = new URLSearchParams({ ref_etax: ref });
  const promesse = requeteApi<ExtractionDetailEtax>(
    `${BASE}/extraction/etat-par-compte/detail-etax?${query.toString()}`,
    { timeoutMs: 120_000 },
  )
    .then((resultat) => {
      valeursDetailEtax.set(ref, resultat);
      return resultat;
    })
    .catch((erreur) => {
      cacheDetailEtax.delete(ref);
      throw erreur;
    });

  cacheDetailEtax.set(ref, promesse);
  return promesse;
}

/** Démarre le chargement Oracle sans attendre (survol de ligne). */
export function prechargerDetailEtax(refEtax: string | null | undefined): void {
  const ref = refEtax?.trim() ?? "";
  if (ref === "" || cacheDetailEtax.has(ref)) return;
  void extraireDetailEtax(ref);
}

export function extraireRecettesPetrolieres1812201(
  dateDebut: string,
  dateFin: string,
): Promise<ExtractionRecettesPetrolieresDetail> {
  const query = new URLSearchParams({
    date_debut: dateDebut,
    date_fin: dateFin,
  });
  return requeteApi(`${BASE}/extraction/1812-201?${query.toString()}`, {
    timeoutMs: 180_000,
  });
}

import type { StatutFicheBleue } from "@/portails/Sp/types/fiche-bleue.interface";
import type { TypeSectionBibliotheque } from "@/portails/Sp/types/bibliotheque.interface";
import type { SpTagKind } from "@/portails/Sp/components/layout/SpTag";
import { formatMontant } from "@/shared/lib/format";

export const STATUT_FICHE_BLEUE: Record<
  StatutFicheBleue,
  { label: string; badge: string; kind: SpTagKind }
> = {
  brouillon: {
    label: "Brouillon",
    badge: "border-transparent bg-muted text-muted-foreground",
    kind: "neu",
  },
  valide: {
    label: "Validée",
    badge: "border-transparent bg-emerald-100 text-emerald-800",
    kind: "ok",
  },
  en_cours: {
    label: "En cours",
    badge: "border-transparent bg-primary/10 text-primary",
    kind: "warn",
  },
  cloture: {
    label: "Clôturée",
    badge: "border-transparent bg-warning/10 text-warning",
    kind: "neu",
  },
};

export function dateIsoJour(d: Date = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function libelleDateFr(d: Date | string = new Date()): string {
  const date = typeof d === "string" ? new Date(d) : d;
  return date.toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

export function formaterDateHeureFr(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formaterMontantFcfa(valeur: string | number): string {
  return formatMontant(valeur);
}

/** Parse un montant API / saisi (espaces, virgule décimale) → nombre ou null. */
export function parseMontantNombre(
  valeur: string | number | null | undefined,
): number | null {
  if (valeur === null || valeur === undefined || valeur === "") return null;
  if (typeof valeur === "number") return Number.isFinite(valeur) ? valeur : null;
  const n = Number(
    String(valeur)
      .replace(/[\s\u00A0\u202F']/g, "")
      .replace(",", "."),
  );
  return Number.isFinite(n) ? n : null;
}

/**
 * Taux d'exécution : (Réalisé ÷ Programmé) × 100.
 * Arrondi scientifique à l'entier (sans décimale) ; « — » si programmé nul.
 */
export function formaterTauxRealise(
  programme: string | number,
  realise: string | number,
): string {
  const p = parseMontantNombre(programme);
  const r = parseMontantNombre(realise);
  if (p === null || p === 0) return "—";
  if (r === null) return "—";
  // Calcul en centimes pour éviter les erreurs de flottants, puis arrondi entier.
  const programmeCentimes = Math.round(p * 100);
  if (programmeCentimes === 0) return "—";
  const realiseCentimes = Math.round(r * 100);
  const taux = (realiseCentimes / programmeCentimes) * 100;
  const entier = Math.round(taux);
  return `${entier} %`;
}

/** Décalage horizontal d'un niveau de sous-section (~1 tabulation). */
export const DECALAGE_SOUS_SECTION_PX = 24;
export const PADDING_SOUS_SECTION_PX = 8;
export const CLASSE_ARBRE_SOUS_SECTION =
  "space-y-1.5 border-l-2 border-muted-foreground/20 pl-6";

export function styleIndentSection(niveau: number): {
  marginLeft: number;
  paddingLeft: number;
} {
  const n = Math.max(0, niveau);
  return {
    marginLeft: n * DECALAGE_SOUS_SECTION_PX,
    paddingLeft: n > 0 ? PADDING_SOUS_SECTION_PX : 0,
  };
}

/** Libellés d'affichage du type — ce ne sont pas des sections. */
export const LIBELLE_GROUPE_TYPE: Record<"recette" | "depense", string> = {
  recette: "RECETTES",
  depense: "DEPENSES",
};

/** Gabarit pré-coché à la création d'une Fiche Bleue (hors Solde). */
export const COMPOSITION_DEFAUT_FICHE_BLEUE: {
  libelle: string;
  type: "recette" | "depense";
}[] = [
  { libelle: "1-RECETTES PROGRAMMEES", type: "recette" },
  { libelle: "2-OPERATIONS DE COMPENSATION", type: "recette" },
  { libelle: "3-ENCAISSEMENT DES RECETTES AFFECTEES", type: "recette" },
  { libelle: "1-DEPENSES PROGRAMMEES", type: "depense" },
  { libelle: "2-DEPENSES NON PROGRAMMEES", type: "depense" },
  { libelle: "3-REVERSEMENT DES RECETTES AFFECTEES", type: "depense" },
  { libelle: "DEPENSES DES POSTES COMPTABLES (CUT)", type: "depense" },
];

export function normaliserLibelleSection(libelle: string): string {
  return libelle
    .trim()
    .toUpperCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/\s*-\s*/g, "-")
    .replace(/\s+/g, " ");
}

export function estConteneurTypeSection(
  libelle: string,
  type: TypeSectionBibliotheque,
  estRacine = true,
): boolean {
  const n = normaliserLibelleSection(libelle);
  if (type === "recette") {
    return (estRacine && n === "RECETTES") || n === "1-RECETTES";
  }
  if (type === "depense") {
    return (estRacine && n === "DEPENSES") || n === "2-DEPENSES";
  }
  return false;
}

export function idsCompositionDefaut(
  recettes: { id: number; libelle: string }[],
  depenses: { id: number; libelle: string }[],
): number[] {
  const parType = {
    recette: recettes,
    depense: depenses,
  };
  const ids: number[] = [];
  for (const item of COMPOSITION_DEFAUT_FICHE_BLEUE) {
    const cible = normaliserLibelleSection(item.libelle);
    const trouvee = parType[item.type].find(
      (s) => normaliserLibelleSection(s.libelle) === cible,
    );
    if (trouvee) ids.push(trouvee.id);
  }
  return ids;
}

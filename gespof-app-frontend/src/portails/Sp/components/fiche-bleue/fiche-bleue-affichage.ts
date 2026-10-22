import type { StatutFicheBleue } from "@/portails/Sp/types/fiche-bleue.interface";
import type { TypeSectionBibliotheque } from "@/portails/Sp/types/bibliotheque.interface";
import { formatMontant } from "@/shared/lib/format";

export const STATUT_FICHE_BLEUE: Record<
  StatutFicheBleue,
  { label: string; badge: string }
> = {
  brouillon: {
    label: "Brouillon",
    badge: "border-transparent bg-muted text-muted-foreground",
  },
  valide: {
    label: "Validée",
    badge: "border-transparent bg-emerald-100 text-emerald-800",
  },
  en_cours: {
    label: "En cours",
    badge: "border-transparent bg-primary/10 text-primary",
  },
  cloture: {
    label: "Clôturée",
    badge: "border-transparent bg-warning/10 text-warning",
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

/** Décalage horizontal d'un niveau de sous-section (tableaux et bibliothèque). */
export const DECALAGE_SOUS_SECTION_PX = 56;
export const PADDING_SOUS_SECTION_PX = 16;
export const CLASSE_ARBRE_SOUS_SECTION =
  "space-y-1.5 border-l-2 border-muted-foreground/20 pl-10";

export function styleIndentSection(niveau: number): {
  marginLeft: number;
  paddingLeft: number;
} {
  return {
    marginLeft: niveau * DECALAGE_SOUS_SECTION_PX,
    paddingLeft: niveau > 0 ? PADDING_SOUS_SECTION_PX : 0,
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

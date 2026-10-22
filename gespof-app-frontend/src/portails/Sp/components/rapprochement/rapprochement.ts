import type { RecetteBeac } from "@/portails/Sp/types/operations-jour.interface";
import type { FicheDepotDetailSp, LigneMouvementSp } from "@/portails/Sp/types/fiche-depot.interface";
import type {
  DepenseValidee,
  FamilleDepense,
  RapprochementElement,
  RecetteValidee,
  TypeRapprochement,
} from "@/portails/Sp/types/journee-tresorerie.interface";

/** Type MIME interne du glisser-déposer (ignoré par les autres zones de dépôt). */
export const TYPE_GLISSER_ELEMENTS = "application/x-gespof-rapprochement";

/**
 * Couleur commune des lignes rapprochées (éléments du jour et rubriques).
 * Liseré en ombre interne : une vraie bordure décalerait les colonnes de l'en-tête.
 */
export const CLASSE_LIGNE_RAPPROCHEE =
  "bg-emerald-50 hover:bg-emerald-100/70 [&>td:first-child]:shadow-[inset_4px_0_0_var(--color-emerald-500)]";

export const LIBELLES_FAMILLE: Record<FamilleDepense, string> = {
  numeraire: "Numéraire",
  sygma: "SYGMA",
  systac: "SYSTAC",
};

/** Libellés propres au type de rapprochement (recettes ou dépenses). */
export const LIBELLES_TYPE: Record<TypeRapprochement, {
  singulier: string;
  pluriel: string;
  colonneJour: string;
  colonneLibelle: string;
  feminin: boolean;
}> = {
  recette: {
    singulier: "recette",
    pluriel: "recettes",
    colonneJour: "Recettes du jour",
    colonneLibelle: "Tiers",
    feminin: true,
  },
  depense: {
    singulier: "dépense",
    pluriel: "dépenses",
    colonneJour: "Dépenses du jour",
    colonneLibelle: "Bénéficiaire",
    feminin: true,
  },
};

/** Élément de la colonne gauche, quel que soit le type (recette ou dépense). */
export interface ElementRapprochable {
  cle: string;
  libelle: string;
  /** Ligne secondaire (référence, OV, famille…). */
  detail: string | null;
  montant: string;
  rapprochement: RapprochementElement | null;
  /** Dépense ajoutée par la dernière fiche complémentaire. */
  nouvelle: boolean;
  /** Valeur filtrable (famille de dépense). */
  categorie: string | null;
  /** Origine Oracle (recettes) ; null pour les dépenses. */
  origine: string | null;
  /** Texte concaténé pour la recherche. */
  recherche: string;
}

export function depuisRecette(r: RecetteValidee): ElementRapprochable {
  const detail = [r.origine, r.reference ? `Réf. ${r.reference}` : null].filter(Boolean).join(" · ");
  return {
    cle: r.cle,
    libelle: r.libelle_tiers ?? "—",
    detail: detail || null,
    montant: r.montant,
    rapprochement: r.rapprochement,
    nouvelle: false,
    categorie: null,
    origine: r.origine || null,
    recherche: [r.origine, r.reference, r.num_reglement, r.libelle_tiers].join(" ").toLowerCase(),
  };
}

export function depuisDepense(d: DepenseValidee): ElementRapprochable {
  const detail = [LIBELLES_FAMILLE[d.famille], d.numero_ov, d.banque].filter(Boolean).join(" · ");
  return {
    cle: d.cle,
    libelle: d.beneficiaire || "—",
    detail: detail || null,
    montant: d.montant,
    rapprochement: d.rapprochement,
    nouvelle: d.nouvelle,
    categorie: d.famille,
    origine: null,
    recherche: [d.beneficiaire, d.numero_ov, d.banque, d.fiche_reference, LIBELLES_FAMILLE[d.famille]]
      .join(" ")
      .toLowerCase(),
  };
}

/** Espaces, espaces insécables et fines insécables des montants formatés. */
const ESPACES_MONTANT = new RegExp("[\\s\\u00A0\\u202F]", "g");

/** Montants manipulés en centimes entiers pour éviter les erreurs d'arrondi. */
export function versCentimes(valeur: string): number {
  const n = Number(String(valeur).replace(ESPACES_MONTANT, "").replace(",", "."));
  return Number.isFinite(n) ? Math.round(n * 100) : 0;
}

export function depuisCentimes(centimes: number): string {
  return (centimes / 100).toFixed(2);
}

export function totalCentimes(elements: { montant: string }[]): number {
  return elements.reduce((somme, e) => somme + versCentimes(e.montant), 0);
}

/** Recherche locale (liste validée) sur origine, référence, n° règlement et tiers. */
export function filtrerRecettes<R extends RecetteBeac>(
  recettes: R[],
  recherche: string,
  origine = "",
): R[] {
  const q = recherche.trim().toLowerCase();
  return recettes.filter((r) => {
    if (origine && r.origine !== origine) return false;
    if (!q) return true;
    return [r.origine, r.reference, r.num_reglement, r.libelle_tiers]
      .some((v) => (v ?? "").toLowerCase().includes(q));
  });
}

/** Page d'une liste locale ; taille « all » = tout sur une page. */
export function paginerLocal<T>(
  liste: T[],
  page: number,
  taille: string,
): { lignes: T[]; page: number; pages: number } {
  if (taille === "all") return { lignes: liste, page: 1, pages: 1 };
  const parPage = Math.max(1, Number(taille) || 1);
  const pages = Math.max(1, Math.ceil(liste.length / parPage));
  const courante = Math.min(Math.max(1, page), pages);
  return {
    lignes: liste.slice((courante - 1) * parPage, courante * parPage),
    page: courante,
    pages,
  };
}

/** Infobulle d'une ligne rapprochée : rubrique de la Fiche d'exécution, date et auteur. */
export function titreRapprochement(
  rapprochement: RapprochementElement | null | undefined,
): string | undefined {
  if (!rapprochement) return undefined;
  const auteur = rapprochement.par ? ` par ${rapprochement.par}` : "";
  return `Rapprochée avec « ${rapprochement.section_nom} » le ${formaterDateHeure(rapprochement.le)}${auteur}`;
}

export function formaterDateHeure(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Familles de dépenses d'une fiche de dépôt, dans l'ordre du backend. */
const FAMILLES_FICHE_DEPOT: [FamilleDepense, keyof Pick<
  FicheDepotDetailSp,
  "mouvements_numeraire" | "mouvements_sygma" | "mouvements_systac"
>][] = [
  ["numeraire", "mouvements_numeraire"],
  ["sygma", "mouvements_sygma"],
  ["systac", "mouvements_systac"],
];

/** Identifiant local d'une ligne de fiche de dépôt (les id ne sont uniques que par famille). */
export function idLigneDepot(famille: FamilleDepense, ligne: LigneMouvementSp): string {
  return `${famille}:${ligne.id}`;
}

/**
 * Clés des dépenses d'une fiche de dépôt, identiques à celles de la liste validée
 * de la journée (`DepenseValidee.cle`). Miroir de `RapprochementService::elementDepense`
 * et `avecCles` côté backend : famille|n° OV|BÉNÉFICIAIRE|date virement|montant#occurrence.
 * À garder synchronisé si la composition de la clé change côté serveur.
 */
export function clesDepensesFiche(fiche: FicheDepotDetailSp): Map<string, string> {
  const occurrences = new Map<string, number>();
  const cles = new Map<string, string>();
  for (const [famille, champ] of FAMILLES_FICHE_DEPOT) {
    for (const ligne of fiche[champ]) {
      const montant = famille === "systac"
        ? (ligne.montant_groupe ?? ligne.depenses ?? 0)
        : (ligne.depenses ?? 0);
      const beneficiaire = famille === "systac" && ligne.designation
        ? ligne.designation
        : (ligne.beneficiaire ?? "");
      const base = [
        famille,
        ligne.numero_ov ?? "",
        beneficiaire.trim().toUpperCase(),
        ligne.date_virement ?? "",
        Number(montant).toFixed(2),
      ].join("|");
      const n = (occurrences.get(base) ?? 0) + 1;
      occurrences.set(base, n);
      cles.set(idLigneDepot(famille, ligne), `${base}#${n}`);
    }
  }
  return cles;
}

import type {
  DepenseAutomatiseeSlug,
  LigneDetailDepenseAutomatisee,
} from "@/portails/Sof/api/depenses-automatisees";

export type DetailColumn = {
  key: string;
  label: string;
  align?: "left" | "right";
  mono?: boolean;
  render?: (ligne: LigneDetailDepenseAutomatisee) => string | null | undefined;
};

export type DepensesAutomatiseesPageConfig = {
  slug: DepenseAutomatiseeSlug;
  title: string;
  description: string;
  detailColumns: DetailColumn[];
  showTitreFilter?: boolean;
};

export const DEPENSES_AUTOMATISEES_CONFIG: Record<
  DepenseAutomatiseeSlug,
  DepensesAutomatiseesPageConfig
> = {
  ordonnances: {
    slug: "ordonnances",
    title: "Règlements sur ordonnances",
    description:
      "Dépenses calculées à partir des imports DC et des règles de fléchage. Les lignes NONE restent à traiter.",
    showTitreFilter: true,
    detailColumns: [
      { key: "categorie", label: "Catégorie" },
      { key: "type", label: "Type" },
      { key: "mois_libelle", label: "Mois" },
      { key: "titre", label: "Titre", mono: true },
      { key: "nature", label: "Nature" },
      { key: "mode_reglement", label: "Mode de règlement", mono: true },
      { key: "montant", label: "Montant", align: "right", mono: true },
      { key: "code", label: "Code", mono: true },
    ],
  },
  "credits-delegues": {
    slug: "credits-delegues",
    title: "Crédits délégués",
    description:
      "Dépenses calculées à partir des imports IG crédits délégués et des règles de fléchage. Anomalie AD_FORMAT_ANORMAL si C_REF1 ≠ 10 chiffres (à confirmer).",
    detailColumns: [
      {
        key: "exercice",
        label: "Exercice",
        render: (ligne) => ligne.type_exercice ?? ligne.exercice,
      },
      {
        key: "anomalie",
        label: "Anomalie",
        mono: true,
        render: (ligne) => ligne.anomalie ?? null,
      },
      { key: "mois_libelle", label: "Mois" },
      { key: "mode", label: "Mode", mono: true },
      { key: "nature", label: "Nature" },
      { key: "montant", label: "Montant", align: "right", mono: true },
      { key: "code", label: "Code", mono: true },
      { key: "titre", label: "Titre", mono: true },
    ],
  },
  avances: {
    slug: "avances",
    title: "Avances au budget",
    description:
      "Dépenses calculées à partir des imports IG avances et des règles de fléchage.",
    detailColumns: [
      { key: "compte", label: "Compte", mono: true },
      { key: "mode", label: "Mode", mono: true },
      { key: "mois_libelle", label: "Mois" },
      { key: "nature", label: "Nature" },
      { key: "montant", label: "Montant", align: "right", mono: true },
      { key: "exercice", label: "Exercice", mono: true },
      { key: "titre_budgetaire", label: "Titre budgétaire", mono: true },
      { key: "code", label: "Code", mono: true },
    ],
  },
  correspondants: {
    slug: "correspondants",
    title: "Correspondants",
    description:
      "Dépenses des correspondants calculées à partir des imports DSI et des règles de fléchage.",
    detailColumns: [
      { key: "categorie", label: "Catégorie" },
      { key: "compte", label: "Compte", mono: true },
      { key: "libelle", label: "Libellé" },
      { key: "mois_libelle", label: "Mois" },
      { key: "code", label: "Code", mono: true },
    ],
  },
};

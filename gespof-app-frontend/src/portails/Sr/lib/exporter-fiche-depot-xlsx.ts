import * as XLSX from "xlsx";
import type {
  FicheDepotDetail,
  LigneMouvement,
  LigneSystacDetail,
} from "@/portails/Sr/types";

/**
 * Export client aligné sur
 * `FICHE_DE_DEPOT_MODELE_CORRIGE.xlsx` (structure des 4 onglets).
 * Les couleurs complètes sont appliquées côté backend à la génération / téléchargement.
 */

function observations(l: LigneMouvement): string {
  return (l.observations ?? []).map((o) => o.contenu).filter(Boolean).join(" — ");
}

function parseMontant(valeur: string | number | null | undefined): number {
  if (valeur == null || valeur === "") return 0;
  const n = Number(String(valeur).replace(/\s/g, "").replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}

function lignesJour(detail: FicheDepotDetail): (string | number | null)[][] {
  const datePres = detail.date_presentation || "";
  const out: (string | number | null)[][] = [
    ["Direction des Règlements"],
    ["Service des Règlements"],
    [null, null, null, null, "REGLEMENTS DU", datePres],
    [],
    ["REGLEMENTS SYGMA"],
    [],
    [
      "Date du Virement",
      "Bénéficiaires",
      null,
      null,
      null,
      "N° O.V.",
      "Banques",
      "Dépenses",
      "Observations",
    ],
    ["OPERATIONS EN NUMERAIRE"],
  ];

  for (const l of detail.mouvements_numeraire) {
    out.push([
      l.date_virement,
      l.beneficiaire,
      null,
      null,
      null,
      l.numero_ov,
      l.banque,
      l.depenses,
      observations(l),
    ]);
  }
  out.push([
    "TOTAL NUMERAIRE",
    null,
    null,
    null,
    null,
    null,
    null,
    parseMontant(detail.total_numeraire),
  ]);

  for (const l of detail.mouvements_sygma) {
    out.push([
      l.date_virement,
      l.beneficiaire,
      null,
      null,
      null,
      l.numero_ov,
      l.banque,
      l.depenses,
      observations(l),
    ]);
  }
  out.push([
    "TOTAL REGLEMENTS SYGMA",
    null,
    null,
    null,
    null,
    null,
    null,
    parseMontant(detail.total_sigma),
  ]);

  for (const l of detail.mouvements_systac) {
    out.push([
      l.date_virement,
      l.designation || l.beneficiaire,
      null,
      null,
      null,
      null,
      null,
      l.montant_groupe ?? l.depenses,
      null,
    ]);
  }
  out.push([
    "TOTAL REGLEMENTS SYSTAC",
    null,
    null,
    null,
    null,
    null,
    null,
    parseMontant(detail.total_groupe || detail.total_systac),
  ]);
  out.push([
    null,
    null,
    null,
    null,
    null,
    null,
    null,
    parseMontant(detail.montant_total),
  ]);
  out.push([]);
  out.push([
    "DIRECTEUR DES REGLEMENTS",
    null,
    null,
    null,
    "VISA DU DIRECTEUR DE LA DEPENSE",
    null,
    null,
    "VISA DU DIRECTEUR DES OPERATIONS MONETAIRES ET FINANCIERES",
  ]);

  return out;
}

const ENTETE_MOUVEMENTS = [
  "C_PCA",
  "C_ORIG",
  "L_ORIG",
  "N_BV",
  "NB_REGL",
  " MONTANT ",
  "MONTANTS GROUPES ",
  "DESIGNATIONS ",
  "D_GENERATION_IP",
];

function feuilleDepuisMouvements(
  mouvements: LigneMouvement[],
): XLSX.WorkSheet {
  const rows: (string | number | null)[][] = [ENTETE_MOUVEMENTS];
  for (const m of mouvements) {
    rows.push([
      null,
      null,
      m.beneficiaire,
      m.numero_ov,
      1,
      m.depenses,
      null,
      m.banque,
      m.date_virement,
    ]);
  }
  if (mouvements.length > 0) {
    const total = mouvements.reduce((s, m) => s + (m.depenses || 0), 0);
    rows.push([null, null, null, null, null, total, null, null, null]);
  }
  return XLSX.utils.aoa_to_sheet(rows);
}

function feuilleDepuisLignesSystac(
  lignes: LigneSystacDetail[],
  totalSystac: number,
  totalGroupe: number,
): XLSX.WorkSheet {
  const rows: (string | number | null)[][] = [ENTETE_MOUVEMENTS];
  let dernierGroupe: number | null = null;

  for (const l of lignes) {
    const debutGroupe = l.id_groupe !== dernierGroupe;
    dernierGroupe = l.id_groupe;
    rows.push([
      null,
      l.c_orig,
      l.l_orig,
      l.n_bv,
      l.nb_regl,
      l.montant_systac,
      debutGroupe ? l.montant_groupe : null,
      debutGroupe ? l.designation : null,
      l.d_generation || l.d_creation_ip,
    ]);
  }

  if (lignes.length > 0) {
    rows.push([null, null, null, null, null, totalSystac, totalGroupe, null, null]);
  }

  return XLSX.utils.aoa_to_sheet(rows);
}

export function genererFicheDepotXlsx(detail: FicheDepotDetail): Blob {
  const feuilleJour = XLSX.utils.aoa_to_sheet(lignesJour(detail));
  feuilleJour["!cols"] = [
    { wch: 16 },
    { wch: 22 },
    { wch: 14 },
    { wch: 14 },
    { wch: 14 },
    { wch: 16 },
    { wch: 12 },
    { wch: 16 },
    { wch: 22 },
  ];

  const classeur = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(classeur, feuilleJour, "Reglements du jour");
  XLSX.utils.book_append_sheet(
    classeur,
    feuilleDepuisMouvements(detail.mouvements_numeraire),
    "Mouvement Numeraire",
  );
  XLSX.utils.book_append_sheet(
    classeur,
    feuilleDepuisMouvements(detail.mouvements_sygma),
    "Mouvement SIGMA",
  );
  XLSX.utils.book_append_sheet(
    classeur,
    feuilleDepuisLignesSystac(
      detail.lignes_systac ?? [],
      parseMontant(detail.total_systac),
      parseMontant(detail.total_groupe),
    ),
    "Mouvement SYSTAC",
  );

  const buffer = XLSX.write(classeur, {
    bookType: "xlsx",
    type: "array",
  }) as ArrayBuffer;

  return new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
}

export function nomFichierFicheDepot(detail: FicheDepotDetail): string {
  const date =
    (detail.date_presentation || "").replace(/\//g, "-") || detail.reference;
  return `REGLEMENTS DU ${date}.xlsx`;
}

export function telechargerFicheDepotXlsx(detail: FicheDepotDetail): void {
  const blob = genererFicheDepotXlsx(detail);
  const url = URL.createObjectURL(blob);
  const lien = document.createElement("a");
  lien.href = url;
  lien.download = nomFichierFicheDepot(detail);
  document.body.appendChild(lien);
  lien.click();
  lien.remove();
  URL.revokeObjectURL(url);
}

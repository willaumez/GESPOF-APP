import * as XLSX from "xlsx";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

export type FormatExportSr = "xlsx" | "pdf";

export type ColonneExport = {
  cle: string;
  libelle: string;
  align?: "left" | "right" | "center";
  /** Largeur indicative Excel (caractères). */
  largeur?: number;
};

/** jsPDF (Helvetica) ne gère pas les espaces fins Unicode de fr-FR. */
function textePourPdf(valeur: string): string {
  return valeur
    .replace(/[\u00A0\u202F\u2007\u2009]/g, " ")
    .replace(/\u2011/g, "-")
    .normalize("NFC");
}

function declencherTelechargement(blob: Blob, nomFichier: string) {
  const url = URL.createObjectURL(blob);
  const lien = document.createElement("a");
  lien.href = url;
  lien.download = nomFichier;
  lien.click();
  URL.revokeObjectURL(url);
}

function dateFichier(): string {
  return new Date().toISOString().slice(0, 10);
}

function largeurColonne(
  colonnes: ColonneExport[],
  lignes: Record<string, string>[],
  index: number,
): number {
  const col = colonnes[index];
  const contenuMax = Math.max(
    col.libelle.length,
    ...lignes.map((l) => String(l[col.cle] ?? "").length),
  );
  return Math.min(48, Math.max(col.largeur ?? 16, contenuMax + 2));
}

export function exporterTableauXlsx(options: {
  titre: string;
  sousTitre?: string;
  colonnes: ColonneExport[];
  lignes: Record<string, string>[];
  nomFichier: string;
}): void {
  const entetes = options.colonnes.map((c) => c.libelle);
  const corps = options.lignes.map((ligne) =>
    options.colonnes.map((c) => ligne[c.cle] ?? ""),
  );

  const meta = [
    [options.titre],
    [options.sousTitre ?? `Exporté le ${new Date().toLocaleString("fr-FR")}`],
    [],
  ];
  const feuille = XLSX.utils.aoa_to_sheet([...meta, entetes, ...corps]);

  const nbCols = options.colonnes.length;
  if (nbCols > 1) {
    feuille["!merges"] = [
      { s: { r: 0, c: 0 }, e: { r: 0, c: nbCols - 1 } },
      { s: { r: 1, c: 0 }, e: { r: 1, c: nbCols - 1 } },
    ];
  }

  feuille["!cols"] = options.colonnes.map((_, i) => ({
    wch: largeurColonne(options.colonnes, options.lignes, i),
  }));

  // Hauteur des lignes pour une lecture confortable
  const rows: XLSX.RowInfo[] = [];
  rows[0] = { hpt: 24 };
  rows[1] = { hpt: 18 };
  rows[3] = { hpt: 20 };
  for (let i = 0; i < corps.length; i++) {
    rows[4 + i] = { hpt: 18 };
  }
  feuille["!rows"] = rows;

  const classeur = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(classeur, feuille, "Export");
  const buffer = XLSX.write(classeur, { bookType: "xlsx", type: "array" });
  declencherTelechargement(
    new Blob([buffer], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    }),
    options.nomFichier.endsWith(".xlsx")
      ? options.nomFichier
      : `${options.nomFichier}.xlsx`,
  );
}

export function exporterTableauPdf(options: {
  titre: string;
  sousTitre?: string;
  colonnes: ColonneExport[];
  lignes: Record<string, string>[];
  nomFichier: string;
}): void {
  const paysage =
    options.colonnes.length > 5 ||
    options.colonnes.some((c) => c.cle === "montant");

  const doc = new jsPDF({
    orientation: paysage ? "landscape" : "portrait",
    unit: "mm",
    format: "a4",
  });

  doc.setFontSize(14);
  doc.text(textePourPdf(options.titre), 14, 16);
  doc.setFontSize(9);
  doc.setTextColor(100);
  doc.text(
    textePourPdf(
      options.sousTitre ?? `Exporté le ${new Date().toLocaleString("fr-FR")}`,
    ),
    14,
    22,
  );
  doc.setTextColor(0);

  const pageW = doc.internal.pageSize.getWidth();
  const marge = 14;
  const utile = pageW - marge * 2;

  const poids = options.colonnes.map((c) => {
    if (c.cle === "montant") return 1.35;
    if (c.cle === "reference" || c.cle === "fiche") return 1.4;
    if (c.cle === "genere_par" || c.cle === "utilisateur") return 1.5;
    if (c.cle === "commentaire") return 1.8;
    if (c.cle === "creation" || c.cle === "date") return 1.15;
    return 1;
  });
  const somme = poids.reduce((a, b) => a + b, 0);
  const largeurs = poids.map((p) => (utile * p) / somme);

  autoTable(doc, {
    startY: 26,
    head: [options.colonnes.map((c) => textePourPdf(c.libelle))],
    body: options.lignes.map((ligne) =>
      options.colonnes.map((c) => textePourPdf(ligne[c.cle] ?? "")),
    ),
    styles: {
      font: "helvetica",
      fontSize: 8,
      cellPadding: { top: 3, right: 3, bottom: 3, left: 3 },
      overflow: "linebreak",
      valign: "middle",
      minCellHeight: 9,
    },
    headStyles: {
      fillColor: [7, 96, 168],
      textColor: 255,
      fontStyle: "bold",
      valign: "middle",
    },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    columnStyles: Object.fromEntries(
      options.colonnes.map((c, i) => [
        i,
        {
          halign: c.align ?? "left",
          cellWidth: largeurs[i],
        },
      ]),
    ),
    margin: { left: marge, right: marge },
  });

  const nom = options.nomFichier.endsWith(".pdf")
    ? options.nomFichier
    : `${options.nomFichier}.pdf`;
  doc.save(nom);
}

export function exporterTableau(options: {
  format: FormatExportSr;
  titre: string;
  sousTitre?: string;
  colonnes: ColonneExport[];
  lignes: Record<string, string>[];
  nomBase: string;
}): void {
  const nom = `${options.nomBase}-${dateFichier()}`;
  if (options.format === "pdf") {
    exporterTableauPdf({ ...options, nomFichier: nom });
    return;
  }
  exporterTableauXlsx({ ...options, nomFichier: nom });
}

/** Colonnes alignées sur Model-Liste-fiches-depot.* */
export const COLONNES_LISTE_FICHES: ColonneExport[] = [
  { cle: "reference", libelle: "Référence", largeur: 24 },
  { cle: "presentation", libelle: "Présentation", largeur: 14 },
  { cle: "montant", libelle: "Montant (FCFA)", align: "right", largeur: 18 },
  { cle: "genere_par", libelle: "Généré par", largeur: 24 },
  { cle: "statut", libelle: "Statut", largeur: 12 },
  { cle: "creation", libelle: "Création", largeur: 18 },
];

/** Colonnes alignées sur Model-Historique.* */
export const COLONNES_HISTORIQUE: ColonneExport[] = [
  { cle: "date", libelle: "Date", largeur: 18 },
  { cle: "fiche", libelle: "Fiche", largeur: 24 },
  { cle: "action", libelle: "Action", largeur: 18 },
  { cle: "statut", libelle: "Statut", largeur: 12 },
  { cle: "utilisateur", libelle: "Utilisateur", largeur: 22 },
  { cle: "matricule", libelle: "Matricule", largeur: 14 },
  { cle: "commentaire", libelle: "Commentaire", largeur: 36 },
];

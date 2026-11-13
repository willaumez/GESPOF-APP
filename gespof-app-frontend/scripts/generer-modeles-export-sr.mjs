import * as XLSX from "xlsx";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import fs from "fs";
import path from "path";

const dir =
  "C:/Users/owani/WORKS/Projects/DOMF-PROJET/GESPOF-APP/gespof-app-backend/public/model_fichiers";
fs.mkdirSync(dir, { recursive: true });

function writeXlsx(nom, titre, colonnes) {
  const ws = XLSX.utils.aoa_to_sheet([
    [titre],
    ["Modele GESPOF — ne pas modifier la ligne d'en-tete"],
    [],
    colonnes,
    ...Array.from({ length: 3 }, () => colonnes.map(() => "")),
  ]);
  ws["!cols"] = colonnes.map((c) => ({ wch: Math.max(c.length + 2, 14) }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Modele");
  const buf = XLSX.write(wb, { bookType: "xlsx", type: "buffer" });
  fs.writeFileSync(path.join(dir, nom), buf);
  console.log("OK", nom);
}

function writePdf(nom, titre, colonnes) {
  const doc = new jsPDF({
    orientation: colonnes.length > 5 ? "landscape" : "portrait",
    unit: "mm",
    format: "a4",
  });
  doc.setFontSize(14);
  doc.text(titre, 14, 16);
  doc.setFontSize(9);
  doc.setTextColor(100);
  doc.text("Modele GESPOF — Pool SR", 14, 22);
  autoTable(doc, {
    startY: 26,
    head: [colonnes],
    body: Array.from({ length: 3 }, () => colonnes.map(() => "")),
    headStyles: { fillColor: [7, 96, 168], textColor: 255, fontStyle: "bold" },
    styles: { fontSize: 8, cellPadding: 2 },
  });
  fs.writeFileSync(path.join(dir, nom), Buffer.from(doc.output("arraybuffer")));
  console.log("OK", nom);
}

const colsListe = [
  "Référence",
  "Présentation",
  "Montant (FCFA)",
  "Généré par",
  "Statut",
  "Création",
];
const colsHist = [
  "Date",
  "Fiche",
  "Action",
  "Statut",
  "Utilisateur",
  "Matricule",
  "Commentaire",
];

writeXlsx("Model-Liste-fiches-depot.xlsx", "Liste des fiches de dépôt", colsListe);
writePdf("Model-Liste-fiches-depot.pdf", "Liste des fiches de dépôt", colsListe);
writeXlsx("Model-Historique.xlsx", "Historique — fiches de dépôt", colsHist);
writePdf("Model-Historique.pdf", "Historique — fiches de dépôt", colsHist);

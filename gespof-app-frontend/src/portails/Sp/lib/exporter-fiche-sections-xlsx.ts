import * as XLSX from "xlsx";
import type { SectionFicheBleue } from "@/portails/Sp/types/fiche-bleue.interface";
import type { SectionFicheExecution } from "@/portails/Sp/types/fiche-execution.interface";

type SectionArbre = {
  nom: string;
  type: string;
  montant_programme: string;
  montant_realise: string;
  montant_ecart: string;
  sous_sections: SectionArbre[];
};

function aplatir(
  sections: SectionArbre[],
  niveau = 0,
): (string | number)[][] {
  const out: (string | number)[][] = [];
  for (const s of sections) {
    const indent = "  ".repeat(niveau);
    out.push([
      `${indent}${s.nom}`,
      s.type,
      s.montant_programme,
      s.montant_realise,
      s.montant_ecart,
    ]);
    if (s.sous_sections.length > 0) {
      out.push(...aplatir(s.sous_sections, niveau + 1));
    }
  }
  return out;
}

function classeurSections(
  titre: string,
  meta: (string | number | null)[][],
  sections: SectionArbre[],
): XLSX.WorkBook {
  const rows: (string | number | null)[][] = [
    ...meta,
    [],
    ["Libellé", "Type", "Programmé (FCFA)", "Réalisé (FCFA)", "Écart (FCFA)"],
    ...aplatir(sections),
  ];
  const feuille = XLSX.utils.aoa_to_sheet(rows);
  feuille["!cols"] = [
    { wch: 48 },
    { wch: 14 },
    { wch: 18 },
    { wch: 18 },
    { wch: 16 },
  ];
  const classeur = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(classeur, feuille, titre.slice(0, 31));
  return classeur;
}

export function blobXlsxFicheBleue(params: {
  reference: string;
  dateCreation: string;
  createur: string;
  montantTotalProgramme: string;
  montantTotalRealise: string;
  montantTotalEcart: string;
  sections: SectionFicheBleue[];
}): Blob {
  const classeur = classeurSections(
    "Fiche Bleue",
    [
      ["Fiche Bleue", params.reference],
      ["Créée le", params.dateCreation],
      ["Créée par", params.createur],
      ["Total programmé", params.montantTotalProgramme],
      ["Total réalisé", params.montantTotalRealise],
      ["Total écart", params.montantTotalEcart],
    ],
    params.sections,
  );
  const buffer = XLSX.write(classeur, { bookType: "xlsx", type: "array" });
  return new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
}

export function blobXlsxFicheExecution(params: {
  reference: string;
  dateCreation: string;
  createur: string;
  montantTotalProgramme: string;
  montantTotalRealise: string;
  montantTotalEcart: string;
  sections: SectionFicheExecution[];
}): Blob {
  const classeur = classeurSections(
    "Fiche execution",
    [
      ["Fiche d'exécution", params.reference],
      ["Créée le", params.dateCreation],
      ["Créée par", params.createur],
      ["Total programmé", params.montantTotalProgramme],
      ["Total réalisé", params.montantTotalRealise],
      ["Total écart", params.montantTotalEcart],
    ],
    params.sections,
  );
  const buffer = XLSX.write(classeur, { bookType: "xlsx", type: "array" });
  return new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
}

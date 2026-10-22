import { formatMontant } from "@/shared/lib/format";
import { echapperHtml, imprimerHtml } from "@/portails/Sp/lib/imprimer-html";

type SectionArbre = {
  nom: string;
  type: string;
  montant_programme: string;
  montant_realise: string;
  montant_ecart: string;
  sous_sections: SectionArbre[];
};

function formater(valeur: string | number): string {
  const formate = formatMontant(valeur);
  return formate === "—" ? String(valeur) : formate;
}

function lignesSections(sections: SectionArbre[], niveau = 0): string {
  return sections
    .map((s) => {
      const pad = niveau * 16;
      const enfants =
        s.sous_sections.length > 0
          ? lignesSections(s.sous_sections, niveau + 1)
          : "";
      return `<tr>
        <td style="padding-left:${12 + pad}px;font-weight:${niveau === 0 ? 700 : 500}">${echapperHtml(s.nom)}</td>
        <td>${echapperHtml(s.type)}</td>
        <td style="text-align:right;font-variant-numeric:tabular-nums">${echapperHtml(formater(s.montant_programme))}</td>
        <td style="text-align:right;font-variant-numeric:tabular-nums">${echapperHtml(formater(s.montant_realise))}</td>
        <td style="text-align:right;font-variant-numeric:tabular-nums">${echapperHtml(formater(s.montant_ecart))}</td>
      </tr>${enfants}`;
    })
    .join("");
}

export function imprimerFicheSections(params: {
  titre: string;
  reference: string;
  meta: string;
  totalProgramme: string;
  totalRealise: string;
  totalEcart: string;
  sections: SectionArbre[];
}): void {
  const html = `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="utf-8" />
  <title>${echapperHtml(params.titre)} ${echapperHtml(params.reference)}</title>
  <style>
    @page { size: A4 landscape; margin: 8mm; }
    * { box-sizing: border-box; }
    body {
      font-family: Arial, Helvetica, sans-serif; color: #111; font-size: 13px;
      margin: 0; padding: 4px 6px;
      -webkit-print-color-adjust: exact; print-color-adjust: exact;
    }
    h1 { font-size: 20px; margin: 0 0 4px; color: #1e4d8c; }
    .meta { color: #555; margin: 0 0 12px; }
    .totaux {
      display: flex; flex-wrap: wrap; gap: 10px; margin-bottom: 14px;
    }
    .totaux span {
      display: inline-flex; flex-direction: column; gap: 2px;
      padding: 8px 12px; border-radius: 8px; background: rgba(30,77,140,.1); color: #1e4d8c;
      min-width: 140px;
    }
    .totaux em { font-style: normal; font-size: 10px; font-weight: 700; text-transform: uppercase; }
    .totaux strong { font-size: 15px; }
    table { width: 100%; border-collapse: collapse; }
    th, td { border: 1px solid #cbd5e1; padding: 8px 10px; text-align: left; }
    th { background: #e8eff9; color: #1e4d8c; font-size: 12px; }
  </style>
</head>
<body>
  <h1>${echapperHtml(params.titre)} ${echapperHtml(params.reference)}</h1>
  <p class="meta">${echapperHtml(params.meta)}</p>
  <div class="totaux">
    <span><em>Programmé</em><strong>${echapperHtml(formater(params.totalProgramme))} FCFA</strong></span>
    <span><em>Réalisé</em><strong>${echapperHtml(formater(params.totalRealise))} FCFA</strong></span>
    <span><em>Écart</em><strong>${echapperHtml(formater(params.totalEcart))} FCFA</strong></span>
  </div>
  <table>
    <thead>
      <tr>
        <th>Libellé</th>
        <th>Type</th>
        <th>Programmé (FCFA)</th>
        <th>Réalisé (FCFA)</th>
        <th>Écart (FCFA)</th>
      </tr>
    </thead>
    <tbody>
      ${lignesSections(params.sections) || `<tr><td colspan="5" style="color:#777;font-style:italic">Aucune section</td></tr>`}
    </tbody>
  </table>
</body>
</html>`;

  imprimerHtml(html, `${params.titre} ${params.reference}`);
}

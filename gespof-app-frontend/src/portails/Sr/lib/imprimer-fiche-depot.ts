import { formatMontant } from "@/shared/lib/format";
import type { FicheDepotDetail, LigneMouvement } from "@/portails/Sr/types";

function formater(valeur: string | number): string {
  const formate = formatMontant(valeur);
  return formate === "—" ? String(valeur) : formate;
}

function echapper(texte: string): string {
  return texte
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function montantLigne(l: LigneMouvement, modeSystac?: boolean): number {
  return modeSystac ? (l.montant_groupe ?? l.depenses) : l.depenses;
}

function beneficiaireLigne(l: LigneMouvement, modeSystac?: boolean): string {
  if (modeSystac) return l.designation || l.beneficiaire || "—";
  return l.beneficiaire || "—";
}

type Section = {
  type: "numeraire" | "sigma" | "systac";
  label: string;
  lignes: LigneMouvement[];
  total: string;
  modeSystac?: boolean;
};

function sections(detail: FicheDepotDetail): Section[] {
  return [
    {
      type: "numeraire",
      label: "Numéraire",
      lignes: detail.mouvements_numeraire,
      total: detail.total_numeraire,
    },
    {
      type: "sigma",
      label: "SYGMA",
      lignes: detail.mouvements_sygma,
      total: detail.total_sigma,
    },
    {
      type: "systac",
      label: "SYSTAC",
      lignes: detail.mouvements_systac,
      total: detail.total_systac,
      modeSystac: true,
    },
  ];
}

function construireHtmlImpression(detail: FicheDepotDetail): string {
  const secs = sections(detail);
  const dateLibelle = detail.date_presentation || "—";

  const equation = secs
    .map(
      (s) =>
        `<span class="term ${s.type}"><em>${echapper(s.label)}</em> <strong>${echapper(formater(s.total))}</strong></span>`,
    )
    .join('<span class="op">+</span>');

  const corps = secs
    .map((s) => {
      const lignes = s.lignes
        .map((l) => {
          const ov = s.modeSystac ? "—" : (l.numero_ov ?? "—");
          const banque = s.modeSystac ? "—" : (l.banque ?? "—");
          return `<tr>
            <td>${echapper(beneficiaireLigne(l, s.modeSystac))}</td>
            <td style="text-align:center">${echapper(ov)}</td>
            <td>${echapper(banque)}</td>
            <td style="text-align:right;font-variant-numeric:tabular-nums">${echapper(formater(montantLigne(l, s.modeSystac)))}</td>
          </tr>`;
        })
        .join("");

      return `
        <tr class="section ${s.type}">
          <td colspan="4">
            <div class="section-bandeau">
              <span>${echapper(s.label.toUpperCase())}</span>
              <strong>${echapper(formater(s.total))} FCFA</strong>
            </div>
          </td>
        </tr>
        ${lignes || `<tr><td colspan="4" style="color:#777;font-style:italic">Aucune ligne ${echapper(s.label.toLowerCase())}</td></tr>`}
      `;
    })
    .join("");

  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="utf-8" />
  <title>Fiche de dépôt ${echapper(detail.reference)}</title>
  <style>
    @page { size: A4 landscape; margin: 8mm; }
    * { box-sizing: border-box; }
    html, body { margin: 0; padding: 0; background: #fff; }
    body {
      font-family: Arial, Helvetica, sans-serif;
      color: #111;
      font-size: 14px;
      line-height: 1.35;
      padding: 4px 6px;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    h1 { font-size: 22px; margin: 0 0 6px; color: #064A85; }
    .meta { color: #555; margin: 0 0 14px; font-size: 13px; }
    .equation {
      display: flex; flex-wrap: wrap; align-items: stretch; gap: 10px;
      border: 1px solid rgba(6, 74, 133, 0.2); background: #EFF4FB; border-radius: 10px;
      padding: 12px 14px; margin-bottom: 16px;
    }
    .term { display: inline-flex; flex-direction: column; gap: 4px; padding: 8px 12px; border-radius: 8px; min-width: 140px; }
    .term em { font-style: normal; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: .04em; }
    .term strong { font-size: 16px; }
    .term.numeraire { background: rgba(139, 92, 246, 0.2); color: #5b21b6; }
    .term.sigma { background: rgba(244, 63, 94, 0.2); color: #9f1239; }
    .term.systac { background: rgba(245, 158, 11, 0.2); color: #92400e; }
    .term.total { background: rgba(6, 74, 133, 0.13); color: #064A85; }
    .op { color: #64748b; font-weight: 700; font-size: 18px; align-self: center; }
    table { width: 100%; border-collapse: collapse; }
    th, td { border: 1px solid #cbd5e1; padding: 0; text-align: left; }
    th { background: #EFF4FB; color: #064A85; font-size: 13px; padding: 10px 12px; }
    td { padding: 9px 12px; font-size: 13px; }
    .section td { padding: 0; border-color: transparent; }
    .section-bandeau {
      display: flex; align-items: center; justify-content: space-between;
      padding: 10px 12px; font-size: 13px; font-weight: 700; letter-spacing: .04em;
    }
    .section.numeraire .section-bandeau { background: rgba(139, 92, 246, 0.1); color: #5b21b6; }
    .section.sigma .section-bandeau { background: rgba(244, 63, 94, 0.1); color: #9f1239; }
    .section.systac .section-bandeau { background: rgba(245, 158, 11, 0.1); color: #92400e; }
    .total-row td {
      background: rgba(6, 74, 133, 0.13); color: #064A85; font-weight: 700;
      padding: 12px; text-transform: uppercase; font-size: 13px;
    }
    @media print {
      body { padding: 0; }
    }
  </style>
</head>
<body>
  <h1>Fiche de dépôt ${echapper(detail.reference)}</h1>
  <p class="meta">Règlements du ${echapper(dateLibelle)} · générée par ${echapper(detail.genere_par.nom_complet)}</p>
  <div class="equation">
    ${equation}
    <span class="op">=</span>
    <span class="term total"><em>Total</em> <strong>${echapper(formater(detail.montant_total))} FCFA</strong></span>
  </div>
  <table>
    <thead>
      <tr>
        <th>Bénéficiaire / Désignation</th>
        <th>N° OV</th>
        <th>Banque</th>
        <th>Dépenses (FCFA)</th>
      </tr>
    </thead>
    <tbody>
      ${corps}
      <tr class="total-row">
        <td colspan="3">Total général</td>
        <td style="text-align:right;font-variant-numeric:tabular-nums">${echapper(formater(detail.montant_total))}</td>
      </tr>
    </tbody>
  </table>
</body>
</html>`;
}

/**
 * Impression via iframe hors écran — pas de fenêtre `about:blank` visible.
 * Taille non nulle pour éviter une page d'impression blanche.
 */
export function imprimerFicheDepot(detail: FicheDepotDetail): void {
  const html = construireHtmlImpression(detail);

  // Retirer un éventuel iframe d'impression précédent.
  document.getElementById("gespof-print-fiche-depot")?.remove();

  const iframe = document.createElement("iframe");
  iframe.id = "gespof-print-fiche-depot";
  iframe.setAttribute("aria-hidden", "true");
  iframe.setAttribute("title", "Impression fiche de dépôt");
  // Hors écran + taille réelle : invisible pour l'utilisateur, contenu imprimable.
  iframe.style.cssText =
    "position:fixed;left:-12000px;top:0;width:1100px;height:800px;border:0;opacity:0;pointer-events:none;";
  document.body.appendChild(iframe);

  const doc = iframe.contentDocument;
  const win = iframe.contentWindow;
  if (!doc || !win) {
    iframe.remove();
    throw new Error("Impossible de préparer l'impression.");
  }

  doc.open();
  doc.write(html);
  doc.close();

  const nettoyer = () => {
    iframe.remove();
  };

  win.addEventListener("afterprint", nettoyer);

  const lancer = () => {
    try {
      win.focus();
      win.print();
    } catch {
      nettoyer();
      return;
    }
    // Sécurité si afterprint n'est pas émis.
    window.setTimeout(nettoyer, 60_000);
  };

  // Laisser le document se peindre avant d'ouvrir le dialogue d'impression.
  window.setTimeout(lancer, 250);
}

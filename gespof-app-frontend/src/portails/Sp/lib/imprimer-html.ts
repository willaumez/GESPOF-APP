/**
 * Impression via iframe hors écran — pas de fenêtre `about:blank` visible.
 */
export function imprimerHtml(html: string, titre = "Impression"): void {
  document.getElementById("gespof-print-frame")?.remove();

  const iframe = document.createElement("iframe");
  iframe.id = "gespof-print-frame";
  iframe.setAttribute("aria-hidden", "true");
  iframe.setAttribute("title", titre);
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
  window.setTimeout(() => {
    try {
      win.focus();
      win.print();
    } catch {
      nettoyer();
      return;
    }
    window.setTimeout(nettoyer, 60_000);
  }, 250);
}

export function echapperHtml(texte: string): string {
  return texte
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

export function declencherTelechargementBlob(blob: Blob, nomFichier: string): void {
  const url = URL.createObjectURL(blob);
  const lien = document.createElement("a");
  lien.href = url;
  lien.download = nomFichier;
  document.body.appendChild(lien);
  lien.click();
  lien.remove();
  URL.revokeObjectURL(url);
}

export interface LigneRapprochement {
  libelle: string;
  montant: number;
}

const MOTS_VIDES = new Set([
  "des", "les", "une", "du", "de", "la", "le", "et", "en", "au", "aux",
  "pour", "sur", "del", "dont", "the", "of", "depense", "depenses",
  "attente", "debits", "autres", "provisions", "programmations",
]);

export function normaliserLibelle(valeur: string): string {
  return valeur
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function tokensLibelle(valeur: string): string[] {
  return normaliserLibelle(valeur)
    .split(" ")
    .filter((mot) => mot.length >= 3 && !MOTS_VIDES.has(mot));
}

function scoreLibelles(section: string, depot: string): number {
  const a = normaliserLibelle(section);
  const b = normaliserLibelle(depot);
  if (!a || !b) return 0;
  if (a === b) return 1;

  const plusCourt = a.length <= b.length ? a : b;
  const plusLong = a.length <= b.length ? b : a;
  if (plusCourt.length >= 5 && plusLong.includes(plusCourt)) return 0.92;

  const ta = tokensLibelle(section);
  const tb = tokensLibelle(depot);
  if (ta.length === 0 || tb.length === 0) return 0;

  const correspond = (x: string, y: string) => x === y || x.includes(y) || y.includes(x);
  const communs = ta.filter((t) => tb.some((u) => correspond(t, u)));
  if (communs.length === 0) return 0;

  const union = new Set([...ta, ...tb]);
  const jaccard = communs.length / union.size;
  if (ta.every((t) => tb.some((u) => correspond(t, u)))) {
    return Math.max(0.78, jaccard);
  }
  return jaccard;
}

function parseMontant(valeur: string): number {
  const n = Number(valeur.replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}

/**
 * Associe chaque ligne de Fiche Bleue à au plus une ligne de fiche de dépôt
 * (libellé, puis montant pour les feuilles).
 */
export function identifierCorrespondances(
  lignes: { id: number; nom: string; montantProgramme: string; estFeuille: boolean }[],
  depot: LigneRapprochement[],
): Set<number> {
  const ids = new Set<number>();
  const prises = new Set<number>();
  const ordonnees = [...lignes].sort((a, b) => {
    if (a.estFeuille !== b.estFeuille) return a.estFeuille ? -1 : 1;
    return b.nom.length - a.nom.length;
  });

  for (const section of ordonnees) {
    let meilleur = { score: 0, index: -1 };
    const montantSection = parseMontant(section.montantProgramme);

    for (let i = 0; i < depot.length; i++) {
      if (prises.has(i)) continue;
      const item = depot[i];
      if (!item.libelle.trim()) continue;

      let score = scoreLibelles(section.nom, item.libelle);
      const montantOk =
        montantSection > 0 && Math.abs(montantSection - item.montant) < 1;
      if (montantOk && score >= 0.25) score += 0.12;
      if (montantOk && score === 0 && section.estFeuille) {
        const memeMontantDepot = depot.filter(
          (d, idx) => !prises.has(idx) && Math.abs(d.montant - item.montant) < 1,
        ).length;
        const memeMontantSection = lignes.filter(
          (l) => l.estFeuille && Math.abs(parseMontant(l.montantProgramme) - montantSection) < 1,
        ).length;
        if (memeMontantDepot === 1 && memeMontantSection === 1) score = 0.6;
      }

      if (score > meilleur.score) meilleur = { score, index: i };
    }

    if (meilleur.score >= 0.55 && meilleur.index >= 0) {
      ids.add(section.id);
      prises.add(meilleur.index);
    }
  }

  return ids;
}

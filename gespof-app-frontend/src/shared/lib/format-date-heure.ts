/** JJ / MM / AAAA - HH : mm */
export function formaterDateHeureMatinale(date: Date): string {
  const jj = String(date.getDate()).padStart(2, "0");
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const aaaa = String(date.getFullYear());
  const hh = String(date.getHours()).padStart(2, "0");
  const min = String(date.getMinutes()).padStart(2, "0");
  return `${jj} / ${mm} / ${aaaa} - ${hh} : ${min}`;
}

/** JJ/MM/AAAA (sans heure) */
export function formaterDateSeuleMatinale(date: Date): string {
  const jj = String(date.getDate()).padStart(2, "0");
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const aaaa = String(date.getFullYear());
  return `${jj}/${mm}/${aaaa}`;
}

const JOURS_FR = [
  "dimanche", "lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi",
] as const;

const MOIS_FR = [
  "janvier", "février", "mars", "avril", "mai", "juin",
  "juillet", "août", "septembre", "octobre", "novembre", "décembre",
] as const;

function capitaliser(texte: string): string {
  return texte.charAt(0).toUpperCase() + texte.slice(1);
}

/** Lundi, 07 Septembre, 2026 */
export function formaterDateLongueFr(date: Date = new Date()): string {
  const jourSemaine = capitaliser(JOURS_FR[date.getDay()]);
  const jour = String(date.getDate()).padStart(2, "0");
  const mois = capitaliser(MOIS_FR[date.getMonth()]);
  const annee = date.getFullYear();
  return `${jourSemaine}, ${jour} ${mois}, ${annee}`;
}

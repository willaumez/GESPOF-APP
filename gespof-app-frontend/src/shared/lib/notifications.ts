export function dateLocaleIso(date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function dateIsoNotification(n: {
  date_creation: string;
  donnees: Record<string, unknown> | null;
}): string {
  const brute = n.donnees?.date ?? n.donnees?.date_presentation;
  if (typeof brute === "string" && /^\d{4}-\d{2}-\d{2}$/.test(brute)) {
    return brute;
  }
  return n.date_creation.slice(0, 10);
}

/** Date locale (AAAA-MM-JJ) de réception de la notification. */
export function dateReceptionNotification(n: { date_creation: string }): string {
  const date = new Date(n.date_creation);
  return Number.isNaN(date.getTime()) ? n.date_creation.slice(0, 10) : dateLocaleIso(date);
}

/**
 * Reçue aujourd'hui. Se base sur la date de réception, pas sur la date métier
 * (`dateIsoNotification`) : une fiche de dépôt reçue aujourd'hui peut porter
 * une date de présentation antérieure.
 */
export function notificationEstDuJour(
  n: { date_creation: string },
  jour = dateLocaleIso(),
): boolean {
  return dateReceptionNotification(n) === jour;
}

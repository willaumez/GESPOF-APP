const INDICE_TECHNIQUE =
  /ORA-\d+|TCP connect|CONNECTION_ID|exception occurred in the driver|Erreur de lecture sur l['’']esclave|SQLSTATE|PDOException|Doctrine\\DBAL|Help:\s*https:\/\/docs\.oracle\.com/i;

const LONGUEUR_MAX_METIER = 180;

/**
 * Remplace un dump technique (Oracle, driver, SQL…) par un libellé métier.
 * Les messages courts et explicites du backend sont conservés.
 */
export function messageDonneesOuDefaut(
  message: string | null | undefined,
  defaut: string,
): string {
  const texte = message?.trim();
  if (!texte || texte.length > LONGUEUR_MAX_METIER || INDICE_TECHNIQUE.test(texte)) {
    return defaut;
  }
  return texte;
}

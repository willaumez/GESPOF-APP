const CLE_JETON = "gespof_token";
const CLE_USER  = "gespof_user";
/** Horodatage (ms) de la dernière fin de session, partagé entre onglets. */
const CLE_FIN_SESSION = "gespof_fin_session";

export function lireJeton(): string | null {
  return localStorage.getItem(CLE_JETON) ?? sessionStorage.getItem(CLE_JETON);
}

export function ecrireJeton(jeton: string, persistant = true): void {
  if (persistant) {
    localStorage.setItem(CLE_JETON, jeton);
    sessionStorage.removeItem(CLE_JETON);
  } else {
    sessionStorage.setItem(CLE_JETON, jeton);
    localStorage.removeItem(CLE_JETON);
  }
}

export function effacerJeton(): void {
  localStorage.removeItem(CLE_JETON);
  sessionStorage.removeItem(CLE_JETON);
  // Déconnexion, inactivité ou jeton expiré : les états d'écran mémorisés avant
  // cet instant appartiennent à la session précédente.
  localStorage.setItem(CLE_FIN_SESSION, String(Date.now()));
}

/** Instant de la dernière fin de session (0 si aucune). */
export function lireFinSession(): number {
  try {
    return Number(localStorage.getItem(CLE_FIN_SESSION)) || 0;
  } catch {
    return 0;
  }
}

export function lireUtilisateur<T>(): T | null {
  try {
    const raw = localStorage.getItem(CLE_USER) ?? sessionStorage.getItem(CLE_USER);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

export function ecrireUtilisateur<T>(user: T, persistant = true): void {
  const json = JSON.stringify(user);
  if (persistant) {
    localStorage.setItem(CLE_USER, json);
    sessionStorage.removeItem(CLE_USER);
  } else {
    sessionStorage.setItem(CLE_USER, json);
    localStorage.removeItem(CLE_USER);
  }
}

export function effacerUtilisateur(): void {
  localStorage.removeItem(CLE_USER);
  sessionStorage.removeItem(CLE_USER);
}

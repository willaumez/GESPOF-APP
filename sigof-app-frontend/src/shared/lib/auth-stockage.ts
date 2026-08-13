const CLE_JETON = "sigof_token";
const CLE_USER  = "sigof_user";

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

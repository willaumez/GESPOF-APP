import { API_CONFIG } from "@/shared/config/app";
import { lireJeton } from "./auth-stockage";

export type OptionsRequete = {
  method?: string;
  body?: string;
  jeton?: string | null;
  timeoutMs?: number;
};

export class ErreurApi extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "ErreurApi";
    this.status = status;
  }
}

/**
 * Émis quand le backend rejette le jeton de session (401 alors qu'un jeton
 * était envoyé) : AuthProvider écoute cet événement pour fermer la session,
 * ce qui laisse les routes protégées rediriger vers la connexion.
 */
export const EVENEMENT_SESSION_EXPIREE = "gespof:session-expiree";

export const MESSAGE_SESSION_EXPIREE =
  "Cette session n'est plus active. Vous avez été connecté sur un autre appareil ou navigateur, ou elle a expiré.";

export const MESSAGE_SERVEUR_INACCESSIBLE =
  "Serveur inaccessible. Vérifiez votre connexion ou réessayez plus tard.";

export const MESSAGE_ERREUR_SERVEUR =
  "Le serveur rencontre une erreur. Réessayez dans un instant.";

/** Message lisible à partir d'un code HTTP et d'un éventuel libellé API. */
export function messageErreurHttp(
  status: number,
  messageApi?: string | null,
): string {
  const api =
    typeof messageApi === "string" && messageApi.trim() !== ""
      ? messageApi.trim()
      : null;

  // Ne pas exposer les messages techniques du type « Internal Server Error ».
  const apiUtilisable =
    api &&
    !/^internal server error$/i.test(api) &&
    !/^erreur http\b/i.test(api) &&
    !/^http\s*\d{3}/i.test(api)
      ? api
      : null;

  if (status === 401) {
    return apiUtilisable ?? "Identifiants incorrects.";
  }
  if (status === 403) {
    return "Vous n'avez pas les droits nécessaires pour cette action.";
  }
  if (status === 404) {
    return apiUtilisable ?? "Ressource introuvable.";
  }
  if (status === 408 || status === 504) {
    return apiUtilisable ?? "La requête a expiré. Réessayez dans un instant.";
  }
  if (status === 502 || status === 503) {
    return MESSAGE_SERVEUR_INACCESSIBLE;
  }
  if (status >= 500) {
    return MESSAGE_ERREUR_SERVEUR;
  }
  return apiUtilisable ?? MESSAGE_SERVEUR_INACCESSIBLE;
}

function lireMessageCorps(corps: Record<string, unknown>): string | null {
  const m = corps.message ?? corps.error ?? corps.detail;
  return typeof m === "string" ? m : null;
}

export async function requeteApi<T>(chemin: string, options: OptionsRequete = {}): Promise<T> {
  const { method = "GET", body, timeoutMs } = options;
  const token = "jeton" in options ? options.jeton : lireJeton();

  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const controller = new AbortController();
  const delai = timeoutMs ?? API_CONFIG.TIMEOUT;
  const minuterie = setTimeout(() => controller.abort(), delai);

  try {
    const reponse = await fetch(`${API_CONFIG.BASE_URL}${chemin}`, {
      method,
      headers,
      body,
      signal: controller.signal,
    });

    if (!reponse.ok) {
      // 401 avec le jeton de session (et non un jeton explicite comme au
      // login) : le backend ne reconnaît plus la session, on la ferme.
      const sessionExpiree = reponse.status === 401 && !!token && !("jeton" in options);
      if (sessionExpiree) {
        window.dispatchEvent(new Event(EVENEMENT_SESSION_EXPIREE));
        throw new ErreurApi(reponse.status, MESSAGE_SESSION_EXPIREE);
      }

      const corps = await reponse.json().catch(() => ({})) as Record<string, unknown>;
      throw new ErreurApi(
        reponse.status,
        messageErreurHttp(reponse.status, lireMessageCorps(corps)),
      );
    }

    if (reponse.status === 204) return undefined as T;
    return reponse.json() as Promise<T>;
  } catch (erreur) {
    if (erreur instanceof ErreurApi) {
      throw erreur;
    }
    if (erreur instanceof DOMException && erreur.name === "AbortError") {
      throw new ErreurApi(408, "La requête a expiré. Réessayez ou réduisez la période.");
    }
    // fetch échoué (réseau coupé, CORS, serveur down…)
    throw new ErreurApi(0, MESSAGE_SERVEUR_INACCESSIBLE);
  } finally {
    clearTimeout(minuterie);
  }
}

/** Envoi multipart (ex. photo de profil, champ `fichier` + fichiers annexes). */
export async function envoyerFichier<T>(
  chemin: string,
  fichier: File,
  options: Pick<OptionsRequete, "jeton" | "timeoutMs"> & {
    nomChamp?: string;
    /** Fichiers supplémentaires (ex. `bandeau` pour le cover profil). */
    annexes?: Record<string, File>;
  } = {},
): Promise<T> {
  const token = "jeton" in options ? options.jeton : lireJeton();
  const formData = new FormData();
  formData.append(options.nomChamp ?? "fichier", fichier);
  if (options.annexes) {
    for (const [nom, annexe] of Object.entries(options.annexes)) {
      formData.append(nom, annexe);
    }
  }

  const headers: Record<string, string> = {};
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const controller = new AbortController();
  const delai = options.timeoutMs ?? API_CONFIG.TIMEOUT;
  const minuterie = setTimeout(() => controller.abort(), delai);

  try {
    const reponse = await fetch(`${API_CONFIG.BASE_URL}${chemin}`, {
      method: "POST",
      headers,
      body: formData,
      signal: controller.signal,
    });

    if (!reponse.ok) {
      const sessionExpiree = reponse.status === 401 && !!token && !("jeton" in options);
      if (sessionExpiree) {
        window.dispatchEvent(new Event(EVENEMENT_SESSION_EXPIREE));
        throw new ErreurApi(reponse.status, MESSAGE_SESSION_EXPIREE);
      }
      const corps = (await reponse.json().catch(() => ({}))) as Record<
        string,
        unknown
      >;
      throw new ErreurApi(
        reponse.status,
        messageErreurHttp(reponse.status, lireMessageCorps(corps)),
      );
    }

    if (reponse.status === 204) return undefined as T;
    return reponse.json() as Promise<T>;
  } catch (erreur) {
    if (erreur instanceof ErreurApi) throw erreur;
    if (erreur instanceof DOMException && erreur.name === "AbortError") {
      throw new ErreurApi(408, "La requête a expiré. Réessayez dans un instant.");
    }
    throw new ErreurApi(0, MESSAGE_SERVEUR_INACCESSIBLE);
  } finally {
    clearTimeout(minuterie);
  }
}

export async function requeteApiBlob(
  chemin: string,
  options: Pick<OptionsRequete, "timeoutMs"> = {},
): Promise<Blob> {
  const token = lireJeton();
  const headers: Record<string, string> = {};
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const controller = new AbortController();
  const delai = options.timeoutMs ?? API_CONFIG.TIMEOUT;
  const minuterie = setTimeout(() => controller.abort(), delai);

  try {
    const reponse = await fetch(`${API_CONFIG.BASE_URL}${chemin}`, {
      headers,
      signal: controller.signal,
    });

    if (!reponse.ok) {
      if (reponse.status === 401 && token) {
        window.dispatchEvent(new Event(EVENEMENT_SESSION_EXPIREE));
        throw new ErreurApi(reponse.status, MESSAGE_SESSION_EXPIREE);
      }

      const corps = await reponse.json().catch(() => ({})) as Record<string, unknown>;
      const messageApi = lireMessageCorps(corps);
      const message =
        reponse.status === 404
          ? messageApi ?? "Le fichier Excel est introuvable sur le serveur."
          : messageErreurHttp(reponse.status, messageApi);
      throw new ErreurApi(reponse.status, message);
    }

    return reponse.blob();
  } catch (erreur) {
    if (erreur instanceof ErreurApi) {
      throw erreur;
    }
    if (erreur instanceof DOMException && erreur.name === "AbortError") {
      throw new ErreurApi(
        408,
        "La génération Excel a expiré. Réessayez dans un instant.",
      );
    }
    throw new ErreurApi(0, MESSAGE_SERVEUR_INACCESSIBLE);
  } finally {
    clearTimeout(minuterie);
  }
}

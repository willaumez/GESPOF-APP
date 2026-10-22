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
      const message = reponse.status === 403
        ? "Vous n'avez pas les droits nécessaires pour cette action."
        : (corps.message as string) ?? `Erreur HTTP ${reponse.status}`;
      throw new ErreurApi(reponse.status, message);
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
    throw erreur;
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
      const messageApi =
        typeof corps.message === "string" && corps.message.trim() !== ""
          ? corps.message
          : null;
      const message =
        reponse.status === 403
          ? "Vous n'avez pas les droits nécessaires pour cette action."
          : messageApi
            ?? (reponse.status === 404
              ? "Le fichier Excel est introuvable sur le serveur."
              : `Erreur HTTP ${reponse.status}`);
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
    throw erreur;
  } finally {
    clearTimeout(minuterie);
  }
}

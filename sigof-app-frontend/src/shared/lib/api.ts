import { API_CONFIG } from "@/shared/config/app";
import { lireJeton } from "./auth-stockage";

export type OptionsRequete = {
  method?: string;
  body?: string;
  jeton?: string | null;
};

export class ErreurApi extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "ErreurApi";
    this.status = status;
  }
}

export async function requeteApi<T>(chemin: string, options: OptionsRequete = {}): Promise<T> {
  const { method = "GET", body } = options;
  const token = "jeton" in options ? options.jeton : lireJeton();

  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const controller = new AbortController();
  const minuterie = setTimeout(() => controller.abort(), API_CONFIG.TIMEOUT);

  try {
    const reponse = await fetch(`${API_CONFIG.BASE_URL}${chemin}`, {
      method,
      headers,
      body,
      signal: controller.signal,
    });

    if (!reponse.ok) {
      const corps = await reponse.json().catch(() => ({})) as Record<string, unknown>;
      const message = reponse.status === 403
        ? "Vous n'avez pas les droits nécessaires pour cette action."
        : (corps.message as string) ?? `Erreur HTTP ${reponse.status}`;
      throw new ErreurApi(reponse.status, message);
    }

    if (reponse.status === 204) return undefined as T;
    return reponse.json() as Promise<T>;
  } finally {
    clearTimeout(minuterie);
  }
}

export async function requeteApiBlob(chemin: string): Promise<Blob> {
  const token = lireJeton();
  const headers: Record<string, string> = {};
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const controller = new AbortController();
  const minuterie = setTimeout(() => controller.abort(), API_CONFIG.TIMEOUT);

  try {
    const reponse = await fetch(`${API_CONFIG.BASE_URL}${chemin}`, {
      headers,
      signal: controller.signal,
    });

    if (!reponse.ok) {
      const message = reponse.status === 403
        ? "Vous n'avez pas les droits nécessaires pour cette action."
        : `Erreur HTTP ${reponse.status}`;
      throw new ErreurApi(reponse.status, message);
    }

    return reponse.blob();
  } finally {
    clearTimeout(minuterie);
  }
}

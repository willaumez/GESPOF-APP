import { API_ENDPOINTS } from "@/config/app";
import { requeteApi } from "@/lib/api";

export type DonneesConnexion = {
  email: string;
  password: string;
};

export type ReponseConnexion = {
  token: string;
};

export class ServiceAuthentification {
  public async connexion(donnees: DonneesConnexion): Promise<ReponseConnexion> {
    return requeteApi<ReponseConnexion>(API_ENDPOINTS.AUTH.LOGIN, {
      method: "POST",
      body: JSON.stringify(donnees),
      jeton: null,
    });
  }

  public async definirMotDePasse(donnees: { newPassword: string }, jeton: string): Promise<ReponseConnexion> {
    return requeteApi<ReponseConnexion>(API_ENDPOINTS.AUTH.DEFINIR_MOT_DE_PASSE, {
      method: "POST",
      body: JSON.stringify(donnees),
      jeton,
    });
  }

  public async rafraichirJeton(jeton: string): Promise<ReponseConnexion> {
    return requeteApi<ReponseConnexion>(API_ENDPOINTS.AUTH.RAFRAICHIR, {
      method: "POST",
      jeton,
    });
  }
}

export const serviceAuthentification = new ServiceAuthentification();

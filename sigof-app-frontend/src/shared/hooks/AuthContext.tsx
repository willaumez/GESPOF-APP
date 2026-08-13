import { useCallback, useEffect, useState } from "react";
import type { ReactNode } from "react";
import { AuthContext } from "./auth-context";
import type { RoleUtilisateur, User } from "./auth-context";
import {
  effacerJeton, ecrireJeton, lireJeton,
  effacerUtilisateur, ecrireUtilisateur, lireUtilisateur,
} from "@/shared/lib/auth-stockage";
import { serviceAuthentification } from "@/shared/lib/auth.service";
import { requeteApi } from "@/shared/lib/api";
import { API_ENDPOINTS } from "@/shared/config/app";

const INACTIVITE_MAX_MS = 60 * 60 * 1000;
const THROTTLE_REFRESH_MS = 90 * 1000;

function decoderJwt(jeton: string): Record<string, unknown> | null {
  try {
    const [, chargeUtile] = jeton.split(".");
    return JSON.parse(atob(chargeUtile.replace(/-/g, "+").replace(/_/g, "/"))) as Record<string, unknown>;
  } catch {
    return null;
  }
}



const ROLES_VALIDES: RoleUtilisateur[] = [
  "ADMINISTRATEUR","AGENT_SOF","CHEF_SOF","AGENT_SP","CHEF_SP",
  "AGENT_SR","CHEF_SR","DIRECTEUR_DOMF","DIRECTION_DG","SUPERVISEUR",
];

function rolesDepuisListe(liste: unknown): RoleUtilisateur[] {
  if (!Array.isArray(liste)) return [];
  const roles = liste
    .map((item) => {
      if (typeof item === "string") return item;
      if (item && typeof item === "object") return String((item as Record<string, unknown>).valeur ?? "");
      return "";
    })
    .filter((v): v is RoleUtilisateur => ROLES_VALIDES.includes(v as RoleUtilisateur));
  return [...new Set(roles)];
}

function construireUtilisateurDepuisJwt(jeton: string, emailConnexion?: string): User | null {
  const payload = decoderJwt(jeton);
  if (!payload) return null;

  const email = String(payload.username ?? payload.email ?? "") || emailConnexion || "";
  if (!email) return null;

  const nomComplet = String(payload.nom_complet ?? "");
  const [nom = "", ...prenomParts] = nomComplet.split(" ");
  const prenom = prenomParts.join(" ");

  const roles = rolesDepuisListe(payload.roles);

  const derniereConnexion = payload.derniere_connexion
    ? String(payload.derniere_connexion)
    : null;

  return { email, nom, prenom, roles, derniereConnexion };
}

function expirationMs(jeton: string): number | null {
  const payload = decoderJwt(jeton);
  const exp = Number(payload?.exp ?? NaN);
  if (Number.isNaN(exp) || exp <= 0) return null;
  return exp * 1000;
}

function initialiserToken(): string | null {
  const jeton = lireJeton();
  if (!jeton) return null;
  const exp = expirationMs(jeton);
  if (exp && exp <= Date.now()) {
    effacerJeton();
    effacerUtilisateur();
    return null;
  }
  return jeton;
}

function initialiserUser(): User | null {
  const jeton = lireJeton();
  if (!jeton) return null;
  const exp = expirationMs(jeton);
  if (exp && exp <= Date.now()) return null;

  const payload = decoderJwt(jeton);
  if (payload?.nom_complet) {
    return construireUtilisateurDepuisJwt(jeton);
  }

  const u = lireUtilisateur<User>();
  if (u && typeof u.prenom === "string" && typeof u.nom === "string") return u;

  return construireUtilisateurDepuisJwt(jeton);
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(initialiserToken);
  const [user,  setUser]  = useState<User | null>(initialiserUser);
  const loading = false;

  const effacer = useCallback(() => {
    effacerJeton();
    effacerUtilisateur();
    setToken(null);
    setUser(null);
  }, []);

  const activerSession = useCallback(async (jeton: string, emailConnexion?: string, persistant = true) => {
    let u = construireUtilisateurDepuisJwt(jeton, emailConnexion);
    if (!u) throw new Error("JWT invalide.");

    try {
      const profil = await requeteApi<{
        email?: string;
        roles?: unknown;
        derniere_connexion?: string;
      }>(API_ENDPOINTS.AUTH.ME, { jeton });
      const rolesProfil = rolesDepuisListe(profil?.roles);
      u = {
        ...u,
        email: profil?.email || u.email,
        roles: rolesProfil.length > 0 ? rolesProfil : u.roles,
        derniereConnexion: profil?.derniere_connexion ?? u.derniereConnexion,
      };
    } catch {
    }

    ecrireJeton(jeton, persistant);
    ecrireUtilisateur(u, persistant);
    setToken(jeton);
    setUser(u);
  }, []);

  const login = useCallback(async (email: string, password: string, persistant = true) => {
    const reponse = await serviceAuthentification.connexion({ email, password });
    await activerSession(reponse.token, email, persistant);
  }, [activerSession]);

  const logout = useCallback(() => {
    effacer();
  }, [effacer]);

  useEffect(() => {
    if (!token) return;
    let lastActivity = Date.now();
    let lastRefresh = Date.now(); 
    let inFlight = false;

    const tentativeRafraichissement = async () => {
      if (inFlight) return;
      const now = Date.now();
      if (now - lastRefresh < THROTTLE_REFRESH_MS) return;

      const jetonCourant = lireJeton();
      if (!jetonCourant) return;

      const exp = expirationMs(jetonCourant);
      if (exp !== null) {
        if (exp <= now) { effacer(); return; }
        if (exp - now > 30 * 60 * 1000) return;
      }

      lastRefresh = now;
      inFlight = true;
      try {
        const rep = await serviceAuthentification.rafraichirJeton(jetonCourant);
        ecrireJeton(rep.token);
        setToken(rep.token);
      } catch {
      } finally {
        inFlight = false;
      }
    };

    const marquerActivite = () => {
      lastActivity = Date.now();
      void tentativeRafraichissement();
    };

    const evenements: Array<keyof WindowEventMap> = ["click", "keydown", "mousemove", "scroll", "touchstart"];
    for (const e of evenements) window.addEventListener(e, marquerActivite, { passive: true });

    const timer = window.setInterval(() => {
      if (Date.now() - lastActivity > INACTIVITE_MAX_MS) effacer();
    }, 15_000);

    return () => {
      for (const e of evenements) window.removeEventListener(e, marquerActivite);
      clearInterval(timer);
    };
  }, [token, effacer]);

  return (
    <AuthContext.Provider value={{ user, token, loading, isAuthenticated: !!user, login, activerSession, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

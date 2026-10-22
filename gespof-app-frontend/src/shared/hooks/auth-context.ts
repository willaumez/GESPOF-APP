import { createContext } from "react";
import type { Acces } from "@/shared/lib/acces";

export type RoleUtilisateur =
  | "ADMINISTRATEUR"
  | "AGENT_SOF"
  | "CHEF_SOF"
  | "AGENT_SR"
  | "CHEF_SR"
  | "AGENT_SP"
  | "CHEF_SP"
  | "DIRECTEUR_DOMF"
  | "DIRECTION_DG"
  | "SUPERVISEUR";

export type Portail = "sof" | "sp" | "sr" | "admin";

export interface User {
  email: string;
  nom: string;
  prenom: string;
  roles: RoleUtilisateur[];
  /** Accès fins autorisés (miroir de la colonne `acces`, rempli depuis /auth/me). Vide tant que /me n'a pas répondu. */
  acces: Acces[];
  derniereConnexion: string | null;
}

export interface AuthContextType {
  user: User | null;
  token: string | null;
  loading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string, persistant?: boolean) => Promise<void>;
  activerSession: (token: string, email?: string, persistant?: boolean) => Promise<void>;
  logout: (motif?: "DECONNEXION" | "INACTIVITE") => Promise<void>;
}

export const AuthContext = createContext<AuthContextType | null>(null);

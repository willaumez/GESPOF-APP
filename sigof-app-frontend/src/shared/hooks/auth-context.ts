import { createContext } from "react";

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
  derniereConnexion: string | null;
}

export interface AuthContextType {
  user: User | null;
  token: string | null;
  loading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string, persistant?: boolean) => Promise<void>;
  activerSession: (token: string, email?: string, persistant?: boolean) => Promise<void>;
  logout: () => void;
}

export const AuthContext = createContext<AuthContextType | null>(null);

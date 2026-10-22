import { ENV } from "@/shared/config/env";

export const APP_CONFIG = {
  NOM: "GESPOF",
  VERSION: "1.0.0",
  DESCRIPTION: "Gestion des Prévisions et des Opérations Financières",
  ENVIRONNEMENT: ENV.MODE,
  DEBUG: ENV.DEV,
} as const;

export const API_CONFIG = {
  BASE_URL: ENV.VITE_API_BASE_URL,
  TIMEOUT: 60000,
} as const;

export const API_ENDPOINTS = {
  VALIDATION: {
    DEMANDE_ACCES: "/api/valider-acces",
  },
  AUTH: {
    LOGIN: "/api/v1/auth/login",
    DEFINIR_MOT_DE_PASSE: "/api/v1/auth/define-password",
    MOT_DE_PASSE_OUBLIE: "/api/v1/auth/login/forgot-password",
    RAFRAICHIR: "/api/v1/auth/refresh",
    ME: "/api/v1/auth/me",
    DECONNEXION: "/api/v1/auth/logout",
    VERIFIER_MOT_DE_PASSE: "/api/v1/auth/verify-password",
    CHANGER_MOT_DE_PASSE: "/api/v1/auth/change-password",
  },
  // Les endpoints du module Service Règlement vivent désormais dans
  // portails/Sr/api/endpoints.ts (colocalisation par module).
} as const;


export const MESSAGES_APPLICATION = {
  SUCCES: {
    CHARGEMENT: "Données chargées avec succès.",
    ENREGISTREMENT: "Enregistrement effectué avec succès.",
  },
  ERREUR: {
    CHARGEMENT: "Erreur lors du chargement des données.",
    RESEAU: "Erreur réseau: impossible de contacter le serveur.",
    SERVEUR: "Erreur interne du serveur.",
  },
} as const;



export const PAGINATION = {
  PAGE_PAR_DEFAUT: 1,
  TAILLE_PAR_DEFAUT: 15,
  OPTIONS_TAILLE: [5, 10, 15, 20, 50, 100, 500],
} as const;

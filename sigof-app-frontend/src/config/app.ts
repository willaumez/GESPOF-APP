
export const APP_CONFIG = {
  NOM: "SIGOF",
  VERSION: "1.0.0",
  DESCRIPTION: "Système Intégré de Gestion des Opérations Financières",
  ENVIRONNEMENT: import.meta.env.MODE || "development",
  DEBUG: import.meta.env.DEV || false,
} as const;

export const API_CONFIG = {
  BASE_URL: import.meta.env.VITE_API_BASE_URL || "",
  TIMEOUT: 60000,
} as const;

export const API_ENDPOINTS = {
  VALIDATION: {
    DEMANDE_ACCES: "/api/valider-acces",
  },
  AUTH: {
    LOGIN: "/api/auth/login",
    DEFINIR_MOT_DE_PASSE: "/api/auth/define-password",
    MOT_DE_PASSE_OUBLIE: "/api/auth/login/forgot-password",
    RAFRAICHIR: "/api/auth/refresh",
    ME: "/api/auth/me",
    VERIFIER_MOT_DE_PASSE: "/api/auth/verify-password",
    CHANGER_MOT_DE_PASSE: "/api/auth/change-password",
  },
  POOL_SR: {
    DASHBOARD_RESUME:          "/api/pool-sr/dashboard/resume",
    DASHBOARD_FICHES_RECENTES: "/api/pool-sr/dashboard/fiches-recentes",
    FICHES_DEPENSES:           "/api/pool-sr/fiches/fichesDepenses",
    FICHE_DETAIL:              "/api/pool-sr/fiches",
    FICHE_GENERER:             "/api/pool-sr/fiches/generer",
    FICHE_GENERER_PROGRESS:             "/api/pool-sr/fiches/generer-progress",
    UTILISATEURS:              "/api/pool-sr/utilisateurs",
    HISTORIQUE:                "/api/pool-sr/historique",
  },
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

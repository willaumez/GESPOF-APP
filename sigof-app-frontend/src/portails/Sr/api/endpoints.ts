export const SERVICE_REGLEMENT_ENDPOINTS = {
  DASHBOARD_RESUME:          "/api/v1/sr/service-reglement/dashboard/resume",
  DASHBOARD_FICHES_RECENTES: "/api/v1/sr/service-reglement/dashboard/fiches-recentes",
  FICHES_DEPENSES:           "/api/v1/sr/service-reglement/fiches/fichesDepenses",
  FICHE_DETAIL:              "/api/v1/sr/service-reglement/fiches",
  FICHE_GENERER:             "/api/v1/sr/service-reglement/fiches/generer",
  FICHE_GENERER_PROGRESS:    "/api/v1/sr/service-reglement/fiches/generer-progress",
  UTILISATEURS:              "/api/v1/sr/service-reglement/utilisateurs",
  HISTORIQUE:                "/api/v1/sr/service-reglement/historique",
} as const;

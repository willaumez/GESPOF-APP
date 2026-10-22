-- Connexion: Oracle (lecture seule) — Service de Prévision
--
-- Recettes — Toutes les opérations de recettes du jour.
-- Table: OP_BEAC
-- Paramètre: :w_date (chaîne DD/MM/YYYY) — date d'ouverture (recuperer-date.sql)
-- Note: les recettes sont toujours validées (d_cpta renseigné), donc pas de statut à calculer.

SELECT o.orig                                              AS ORIGINE,
       o.d_oper                                            AS DATE_RECEPTION,
       o.d_cpta                                            AS DATE_VALIDATION,
       'RECETTE'                                            AS TYPE_OPERATION,
       o.m_oper                                            AS MONTANT,
       o.c_ref                                             AS REFERENCE,
       o.n_regl                                            AS NUM_REGLEMENT,
       o.l_tiers                                           AS LIBELLE_TIERS,
       (o.d_cpta - o.d_oper)                                AS DELAI_JOURS
FROM   gtr.OP_BEAC o
WHERE  o.c_pc   = 1140
AND    o.c_typ  = 'R'
AND    o.d_oper = TO_DATE(:w_date, 'DD/MM/YYYY')
ORDER  BY DELAI_JOURS DESC


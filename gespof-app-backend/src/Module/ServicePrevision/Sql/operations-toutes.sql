-- Connexion: Oracle (lecture seule) — Service de Prévision
--
-- Recettes et dépenses — c) Toutes les opérations du jour, avec statut.
-- Table: OP_BEAC
-- Paramètre: :w_date (chaîne DD/MM/YYYY) — date d'ouverture (recuperer-date.sql)

SELECT o.orig                                              AS ORIGINE,
       o.d_oper                                            AS DATE_RECEPTION,
       o.d_cpta                                            AS DATE_VALIDATION,
       CASE o.c_typ WHEN 'R' THEN 'RECETTE' WHEN 'D' THEN 'DEPENSE' ELSE o.c_typ END AS TYPE_OPERATION,
       o.m_oper                                            AS MONTANT,
       o.c_ref                                             AS REFERENCE,
       o.n_regl                                            AS NUM_REGLEMENT,
       o.l_tiers                                           AS LIBELLE_TIERS,
       CASE WHEN o.d_cpta IS NULL THEN 'NON VALIDEE' ELSE 'VALIDEE' END AS STATUT,
       CASE WHEN o.d_cpta IS NULL
            THEN (SYSDATE - o.d_oper)
            ELSE (o.d_cpta - o.d_oper)
       END                                                  AS DELAI_JOURS
FROM   OP_BEAC o
WHERE  o.c_pc  = 1140
AND    o.d_oper = TO_DATE(:w_date, 'DD/MM/YYYY')
ORDER  BY STATUT, DELAI_JOURS DESC


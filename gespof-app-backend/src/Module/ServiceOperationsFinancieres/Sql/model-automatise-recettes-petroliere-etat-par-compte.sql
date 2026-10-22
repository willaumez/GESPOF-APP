-- Connexion: Oracle (lecture seule) — Service des Opérations Financières
--
-- Recettes pétrolières — états par compte : détail OP BEAC + E-TAX.
-- Trois requêtes :
--   (1) recettes avec détail (période)
--   (2) lignes E-TAX de toute la période (préchargement dialogue)
--   (3) lignes E-TAX d'une référence (repli / API détail)
--
-- Schémas (dépendances Forms / synonymes) :
--   GTR : OP_BEAC, REGL, DOPE, VBAL, NATU
--   SGP : SGP_LIIR, SGP_LIIR_DET
--
-- =====================================================================
-- Index recommandés (à créer côté DBA — non exécutés par l’application)
-- Vérifier d’abord :
--   SELECT table_owner, table_name, index_name, column_position, column_name
--   FROM   all_ind_columns
--   WHERE  table_name IN ('OP_BEAC','SGP_LIIR','SGP_LIIR_DET','REGL','DOPE','VBAL','NATU')
--   ORDER  BY table_owner, table_name, index_name, column_position;
-- =====================================================================

-- Filtres principaux
--CREATE INDEX gtr.idx_op_beac_typ_date
--    ON gtr.op_beac (c_typ, d_oper) ONLINE;

--CREATE INDEX sgp.idx_sgp_liir_regl
--    ON sgp.sgp_liir (n_regl, c_ref, l_motif) ONLINE;

--CREATE INDEX sgp.idx_sgp_liir_det_ref
--    ON sgp.sgp_liir_det (c_ref) ONLINE;

-- Jointures (si absentes des clés primaires)
--CREATE INDEX gtr.idx_regl_pca_cpta_regl
--    ON gtr.regl (c_pca, d_cpta, n_regl) ONLINE;

--CREATE INDEX gtr.idx_dope_pca_cpta_op
--    ON gtr.dope (c_pca, d_cpta, n_op, n_lig_op) ONLINE;

--CREATE INDEX gtr.idx_vbal_it_val
--    ON gtr.vbal (c_it, d_deb_val) ONLINE;

--CREATE INDEX gtr.idx_natu_typ_nat
--    ON gtr.natu (c_typnat, c_nat) ONLINE;

-- =====================================================================
-- 1. Recettes avec le détail
--    Tables: GTR.OP_BEAC, GTR.REGL, GTR.DOPE, GTR.VBAL, SGP.SGP_LIIR
--
--    Données d'entrée :
--      :date_debut  — date de début (borne inclusive, format DD/MM/YYYY)
--      :date_fin    — date de fin (borne inclusive, format DD/MM/YYYY)
-- =====================================================================
WITH ops AS (
    SELECT o.*
    FROM   gtr.op_beac o
    WHERE  o.c_typ  = 'R'
    AND    o.d_oper >= TO_DATE(:date_debut, 'DD/MM/YYYY')
    AND    o.d_oper <  TO_DATE(:date_fin,   'DD/MM/YYYY') + 1
),
etax AS (
    SELECT n_regl, MAX(c_ref) AS c_ref, MAX(l_motif) AS l_motif
    FROM   sgp.sgp_liir
    WHERE  n_regl IN (SELECT n_regl FROM ops WHERE c_fisc = 'O')
    GROUP  BY n_regl
    HAVING COUNT(*) = 1
)
SELECT o.d_oper    AS d_oper,
       o.orig      AS orig,
       o.c_typ     AS c_typ,
       o.c_ref     AS c_ref,
       o.l_tiers   AS l_tiers,
       o.l_obj     AS l_obj,
       o.l_com     AS l_com,
       o.l_exp     AS l_exp,
       o.l_dest    AS l_dest,
       o.m_oper    AS montant,
       o.c_pc      AS c_pc,
       o.n_regl    AS n_regl,
       o.d_cpta    AS d_cpta,
       o.n_mattir  AS n_mattir,
       dp.c_it     AS compte,
       vb.l_it     AS libelle_compte,
       et.c_ref    AS ref_etax,
       et.l_motif  AS motif_etax
FROM   ops o
       LEFT JOIN gtr.regl r  ON r.c_pca  = o.c_pc
                            AND r.d_cpta = o.d_cpta
                            AND r.n_regl = o.n_regl
       LEFT JOIN gtr.dope dp ON dp.c_pca    = o.c_pc
                            AND dp.d_cpta   = o.d_cpta
                            AND dp.n_op     = r.n_op
                            AND dp.n_lig_op = 1
       LEFT JOIN gtr.vbal vb ON vb.c_it      = dp.c_it
                            AND vb.d_deb_val = dp.d_deb_val
       LEFT JOIN etax et     ON et.n_regl = o.n_regl
                            AND o.c_fisc  = 'O'
ORDER  BY o.d_oper, o.n_doc;

-- =====================================================================
-- 2. Lignes du détail E-TAX pour toute la période (préchargement)
--    Tables: GTR.OP_BEAC, SGP.SGP_LIIR, SGP.SGP_LIIR_DET, GTR.NATU
--
--    Données d'entrée :
--      :date_debut  — même borne que la requête 1
--      :date_fin    — même borne que la requête 1
-- =====================================================================
WITH ops AS (
    SELECT o.n_regl
    FROM   gtr.op_beac o
    WHERE  o.c_typ  = 'R'
    AND    o.c_fisc = 'O'
    AND    o.d_oper >= TO_DATE(:date_debut, 'DD/MM/YYYY')
    AND    o.d_oper <  TO_DATE(:date_fin,   'DD/MM/YYYY') + 1
),
etax AS (
    SELECT MAX(c_ref) AS c_ref
    FROM   sgp.sgp_liir
    WHERE  n_regl IN (SELECT n_regl FROM ops)
    GROUP  BY n_regl
    HAVING COUNT(*) = 1
)
SELECT d.c_ref   AS ref_etax,
       d.c_nat   AS nature,
       n.l_nat   AS libelle_nature,
       d.m_det   AS montant
FROM   etax e
       INNER JOIN sgp.sgp_liir_det d ON d.c_ref = e.c_ref
       LEFT JOIN gtr.natu n ON n.c_typnat = d.c_typnat
                           AND n.c_nat    = d.c_nat
ORDER  BY d.c_ref, d.c_nat;

-- =====================================================================
-- 3. Lignes du détail E-TAX pour une référence (API détail / repli)
--    Tables: SGP.SGP_LIIR_DET, GTR.NATU
--
--    Données d'entrée :
--      :ref_etax  — référence E-TAX (c_ref de sgp_liir)
-- =====================================================================
SELECT d.c_nat   AS nature,
       n.l_nat   AS libelle_nature,
       d.m_det   AS montant
FROM   sgp.sgp_liir_det d
       LEFT JOIN gtr.natu n ON n.c_typnat = d.c_typnat
                           AND n.c_nat    = d.c_nat
WHERE  d.c_ref = :ref_etax
ORDER  BY d.c_nat;

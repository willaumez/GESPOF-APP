-- Connexion: Oracle (lecture seule) — Service des Opérations Financières
--
-- Remboursements de TVA de l'exercice — Compte 4781-31 / Nature 81
-- Tables: DMC.RATT, DMC.REGT, DMC.MTRE, DMC.MDRG, DMC.BENE, DMC.BENC, GTR.TBPC, GTR.VBAL, GTR.NATU
--
-- Données d'entrée :
--   :d_debut  — date de début de l'exercice (chaîne DD/MM/YYYY)
--   :d_fin    — date de fin d'exercice ou de coupure de gestion (chaîne DD/MM/YYYY)
--   Compte    — 4781-31 (figé)
--   Nature    — 81 (figé)
--
-- Exemple d'exercice : 01/01/2022 au 31/01/2022
--
-- Index utiles :
--   CREATE INDEX DMC.idx_ratt_cit_cnat   ON DMC.RATT (C_IT, C_NAT, C_ORIG, N_EMIS);
--   CREATE INDEX DMC.idx_regt_orig_emis  ON DMC.REGT (C_ORIG, N_EMIS, D_REGL);
--   CREATE INDEX GTR.idx_vbal_cit_ddebv  ON GTR.VBAL (C_IT, D_DEB_VAL);

WITH lib_compte AS (
    SELECT v.l_it
    FROM   GTR.VBAL v
    WHERE  v.c_it = '4781-31'
    AND    v.d_deb_val = (SELECT MAX(d_deb_val) FROM GTR.VBAL WHERE c_it = '4781-31')
),
lib_nature AS (
    SELECT n.l_nat
    FROM   GTR.NATU n
    WHERE  n.c_nat = 81
)
SELECT regt.n_emis,
       regt.n_regl,
       ratt.d_emis,
       ratt.c_it,
       ratt.c_nat,
       mtre.c_pc,
       lc.l_it                                                        AS libelle_compte,
       ln.l_nat                                                       AS libelle_nature,
       tbpc.l_pc,
       mdrg.c_banque,
       regt.c_mdr,
       regt.n_cptb,
       CASE WHEN regt.n_benc IS NULL THEN regt.n_mattir END           AS n_mattir,
       CASE WHEN regt.n_benc IS NULL
            THEN (SELECT b.l_nm1tir FROM DMC.BENE b WHERE b.n_mattir = regt.n_mattir)
            ELSE (SELECT b.l_nm1tir FROM DMC.BENC b WHERE b.n_benc  = regt.n_benc)
       END                                                             AS nom,
       regt.n_benc,
       regt.m_regl,
       regt.m_regl - NVL(regt.m_prec_tva, 0)                          AS m_net,
       regt.d_regl,
       regt.n_bv,
       regt.n_cbanq,
       ratt.l_ref1, ratt.l_ref2, ratt.l_ref3, ratt.l_ref4
FROM   DMC.RATT ratt
JOIN   DMC.REGT regt ON regt.c_orig = ratt.c_orig AND regt.n_emis = ratt.n_emis
JOIN   DMC.MTRE mtre ON mtre.c_orig = ratt.c_orig AND mtre.n_emis = ratt.n_emis
JOIN   GTR.TBPC tbpc ON tbpc.c_pc = mtre.c_pc
LEFT JOIN DMC.MDRG mdrg ON mdrg.c_mdr = regt.c_mdr
CROSS JOIN lib_compte lc
CROSS JOIN lib_nature ln
WHERE  ratt.c_it   = '4781-31'
AND    ratt.c_nat  = 81
AND    regt.c_orig = 'M'
AND    regt.m_regl > 0
AND    regt.d_regl BETWEEN TO_DATE(:d_debut, 'DD/MM/YYYY') AND TO_DATE(:d_fin, 'DD/MM/YYYY')
ORDER  BY regt.d_regl, regt.n_emis, regt.n_regl;

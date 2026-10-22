-- Connexion: Oracle (lecture seule) — Service des Opérations Financières
--
-- Restes à Payer — Compte 4781-31 / Nature 81
-- Tables: RATT, REGT, MTRE, TBPC, VBAL, NATU, BENE, BENC
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
--   CREATE INDEX idx_ratt_extract ON RATT (C_ORIG, C_IT, C_NAT, D_EMIS);
--   CREATE INDEX idx_regt_extract ON REGT (C_ORIG, N_EMIS, D_REGL);

WITH lib_compte AS (
    SELECT v.l_it
    FROM   VBAL v
    WHERE  v.c_it = '4781-31'
    AND    v.d_deb_val = (SELECT MAX(d_deb_val) FROM VBAL WHERE c_it = '4781-31')
),
lib_nature AS (
    SELECT n.l_nat
    FROM   NATU n
    WHERE  n.c_nat = 81
)
SELECT mtre.c_pc,
       tbpc.l_pc,
       ratt.n_emis,
       ratt.d_emis,
       ratt.c_it,
       lc.l_it                                                        AS libelle_compte,
       ratt.c_typnat,
       ratt.c_nat,
       ln.l_nat                                                       AS libelle_nature,
       ratt.c_mdr,
       CASE WHEN ratt.n_benc IS NULL THEN ratt.n_mattir END           AS n_mattir,
       CASE WHEN ratt.n_benc IS NULL
            THEN (SELECT b.l_nm1tir FROM BENE b WHERE b.n_mattir = ratt.n_mattir)
            ELSE (SELECT b.l_nm1tir FROM BENC b WHERE b.n_benc  = ratt.n_benc)
       END                                                             AS nom,
       ratt.n_benc,
       ratt.m_rest                                                    AS rap,
       ratt.d_visa,
       ratt.l_ref1 || ' ' || ratt.l_ref2                               AS objet,
       ratt.l_ref3                                                    AS ref,
       ratt.c_blocag,
       ratt.l_blocag,
       'R'                                                             AS orig
FROM   RATT ratt
JOIN   MTRE mtre ON mtre.c_orig = ratt.c_orig AND mtre.n_emis = ratt.n_emis
JOIN   TBPC tbpc ON tbpc.c_pc = mtre.c_pc
CROSS JOIN lib_compte lc
CROSS JOIN lib_nature ln
WHERE  ratt.c_orig = 'M'
AND    ratt.c_it   = '4781-31'
AND    ratt.c_nat  = 81
AND    ratt.m_rest > 0
AND    ratt.d_emis BETWEEN TO_DATE(:d_debut, 'DD/MM/YYYY') AND TO_DATE(:d_fin, 'DD/MM/YYYY')

UNION ALL

SELECT mtre.c_pc,
       tbpc.l_pc,
       ratt.n_emis,
       ratt.d_emis,
       ratt.c_it,
       lc.l_it,
       ratt.c_typnat,
       ratt.c_nat,
       ln.l_nat,
       regt.c_mdr,
       CASE WHEN ratt.n_benc IS NULL THEN ratt.n_mattir END           AS n_mattir,
       CASE WHEN ratt.n_benc IS NULL
            THEN (SELECT b.l_nm1tir FROM BENE b WHERE b.n_mattir = ratt.n_mattir)
            ELSE (SELECT b.l_nm1tir FROM BENC b WHERE b.n_benc  = ratt.n_benc)
       END                                                             AS nom,
       ratt.n_benc,
       regt.m_regl                                                    AS rap,
       ratt.d_visa,
       ratt.l_ref1 || ' ' || ratt.l_ref2                               AS objet,
       ratt.l_ref3                                                    AS ref,
       ratt.c_blocag,
       ratt.l_blocag,
       'T'                                                             AS orig
FROM   RATT ratt
JOIN   REGT regt ON regt.c_orig = ratt.c_orig AND regt.n_emis = ratt.n_emis
JOIN   MTRE mtre ON mtre.c_orig = ratt.c_orig AND mtre.n_emis = ratt.n_emis
JOIN   TBPC tbpc ON tbpc.c_pc = mtre.c_pc
CROSS JOIN lib_compte lc
CROSS JOIN lib_nature ln
WHERE  ratt.c_orig  = 'M'
AND    ratt.c_it    = '4781-31'
AND    ratt.c_nat   = 81
AND    regt.m_regl  > 0
AND    regt.d_regl IS NULL
AND    ratt.d_emis BETWEEN TO_DATE(:d_debut, 'DD/MM/YYYY') AND TO_DATE(:d_fin, 'DD/MM/YYYY')

ORDER BY d_emis;



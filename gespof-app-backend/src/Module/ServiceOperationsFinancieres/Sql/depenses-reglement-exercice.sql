-- Connexion: Oracle (lecture seule) — Service des Opérations Financières
--
-- ⚠ ANCIENNE VERSION — remplacée pour l'import F2 par
--   depenses-reglements-ordonnances-xrgv.sql (export XRGV, 37 colonnes).
-- Conservée pour comparaison / justification historique uniquement.
-- Ne pas brancher dans ScriptPoolSof pour les nouveaux imports.
--
-- Règlements de l'exercice (origine budgétaire B).
-- Tables: gtr.REGT, RATT, DORD, BENE, BENC
--
-- Données d'entrée :
--   :d_debut  — 1er janvier de l'exercice courant (chaîne DD/MM/YYYY)
--   :d_fin    — dernier jour de l'exercice / date de confection des états financiers
--
-- Exemple d'exercice : 01/01/2022 au 31/01/2022

SELECT
    DORD.N_EMIS                                            AS N_ORDO,
    REGT.N_REGL,
    RATT.D_EMIS                                            AS "Dat Emis",
    REGT.D_REGL                                            AS "Dat Régl",
    CASE WHEN REGT.N_BENC IS NULL THEN REGT.N_MATTIR END   AS "Matricule",
    COALESCE(BENC.L_NM1TIR, BENE.L_NM1TIR)                 AS "Nom Bénéficiaire",
    REGT.C_MDR                                             AS "Mdr",
    RATT.L_REF1                                            AS "Objet de la Dépense",
    DORD.C_TITR                                            AS "Titr",
    DORD.C_PCB                                             AS "PC",
    CASE
        WHEN DORD.C_PCB <> 0
             AND DORD.C_PCB < 5000
             AND DORD.C_PCB NOT IN (450, 600)
             AND REGT.C_MDR NOT IN (900, 650)     THEN 'AGC'
        WHEN REGT.C_MDR >= 700                    THEN 'TPG'
        ELSE 'REG'
    END                                                     AS "Categ",
    REGT.M_REGL                                            AS "Montant Réglé",
    REGT.M_REGL - NVL(REGT.M_PREC_TVA, 0)                  AS "Montant Net"
FROM gtr.REGT
JOIN RATT ON RATT.C_ORIG = REGT.C_ORIG AND RATT.N_EMIS = REGT.N_EMIS
JOIN DORD ON DORD.C_ORIG = RATT.C_ORIG AND DORD.N_EMIS = RATT.N_EMIS
LEFT JOIN BENE ON REGT.N_BENC IS NULL     AND BENE.N_MATTIR = REGT.N_MATTIR
LEFT JOIN BENC ON REGT.N_BENC IS NOT NULL AND BENC.N_BENC   = REGT.N_BENC
WHERE REGT.M_REGL > 0
  AND REGT.C_ORIG = 'B'
  AND REGT.D_REGL BETWEEN TO_DATE(:d_debut, 'DD/MM/YYYY') AND TO_DATE(:d_fin, 'DD/MM/YYYY')
ORDER BY REGT.D_REGL, DORD.N_EMIS, REGT.N_REGL;

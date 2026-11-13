-- Connexion: Oracle (lecture seule) — Service des Opérations Financières
--
-- F2 · Règlements sur ordonnances en mode BOP (équivalent export XRGV).
-- Source métier : DC › Suivi Règlements › Statistiques Règlements
--                 › Export EXCEL des Règlements sur Ordos en mode BOP
--
-- ⚠ SQL À FOURNIR — colonnes attendues (alias exacts, 37) :
--   TYPE, TYPE_1, CATEG, EX, DAT_REGL, ORDONNANCE, N_REGL, D_EMIS,
--   MIN, L_MIN, MISSION, L_MIS, PROG, ACTION, TITRE, BOP, L_BOP,
--   UO, L_UO, PC, LIB_PC, L_PROG, NAT, NATURE, BANQUE, MDR,
--   COMPTE_BANC, MATRIC, NOM, M_REGL, M_NET, M_PREC_TVA,
--   N_MANDAT_TVA, OBJET, NUM_BV, N_CBANQ, D_ECHE
--
-- Données d'entrée :
--   :d_debut  — 1er janvier de l'exercice (chaîne DD/MM/YYYY)
--   :d_fin    — date de situation / fin de période (chaîne DD/MM/YYYY)
--
-- Filtres métier : règlements du 1er janvier à la date, tous comptes bancaires.
-- Montants en FCFA. Les doublons (ordonnance + n_regl) sont retirés côté import.
--
-- Remplacer le SELECT ci-dessous par la requête XRGV réelle.

SELECT
    CAST(NULL AS VARCHAR2(32)) AS TYPE,
    CAST(NULL AS VARCHAR2(32)) AS TYPE_1,
    CAST(NULL AS VARCHAR2(32)) AS CATEG,
    CAST(NULL AS VARCHAR2(8))  AS EX,
    CAST(NULL AS DATE)         AS DAT_REGL,
    CAST(NULL AS VARCHAR2(32)) AS ORDONNANCE,
    CAST(NULL AS VARCHAR2(32)) AS N_REGL,
    CAST(NULL AS DATE)         AS D_EMIS,
    CAST(NULL AS VARCHAR2(16)) AS MIN,
    CAST(NULL AS VARCHAR2(255)) AS L_MIN,
    CAST(NULL AS VARCHAR2(32)) AS MISSION,
    CAST(NULL AS VARCHAR2(255)) AS L_MIS,
    CAST(NULL AS VARCHAR2(32)) AS PROG,
    CAST(NULL AS VARCHAR2(32)) AS ACTION,
    CAST(NULL AS VARCHAR2(16)) AS TITRE,
    CAST(NULL AS VARCHAR2(32)) AS BOP,
    CAST(NULL AS VARCHAR2(255)) AS L_BOP,
    CAST(NULL AS VARCHAR2(32)) AS UO,
    CAST(NULL AS VARCHAR2(255)) AS L_UO,
    CAST(NULL AS VARCHAR2(16)) AS PC,
    CAST(NULL AS VARCHAR2(255)) AS LIB_PC,
    CAST(NULL AS VARCHAR2(255)) AS L_PROG,
    CAST(NULL AS VARCHAR2(16)) AS NAT,
    CAST(NULL AS VARCHAR2(255)) AS NATURE,
    CAST(NULL AS VARCHAR2(64)) AS BANQUE,
    CAST(NULL AS VARCHAR2(16)) AS MDR,
    CAST(NULL AS VARCHAR2(64)) AS COMPTE_BANC,
    CAST(NULL AS VARCHAR2(64)) AS MATRIC,
    CAST(NULL AS VARCHAR2(255)) AS NOM,
    CAST(NULL AS NUMBER(20,2)) AS M_REGL,
    CAST(NULL AS NUMBER(20,2)) AS M_NET,
    CAST(NULL AS NUMBER(20,2)) AS M_PREC_TVA,
    CAST(NULL AS VARCHAR2(32)) AS N_MANDAT_TVA,
    CAST(NULL AS VARCHAR2(500)) AS OBJET,
    CAST(NULL AS VARCHAR2(64)) AS NUM_BV,
    CAST(NULL AS VARCHAR2(64)) AS N_CBANQ,
    CAST(NULL AS DATE)         AS D_ECHE
FROM DUAL
WHERE 1 = 0
  AND TO_DATE(:d_debut, 'DD/MM/YYYY') IS NOT NULL
  AND TO_DATE(:d_fin, 'DD/MM/YYYY') IS NOT NULL
;

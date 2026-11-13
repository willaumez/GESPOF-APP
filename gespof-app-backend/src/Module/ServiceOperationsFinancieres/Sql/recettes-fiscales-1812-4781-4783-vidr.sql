-- Connexion: Oracle (lecture seule) — Service des Opérations Financières
--
-- F1 · Recettes fiscales (comptes 1812 / 4781 / 4783).
-- Source métier : IG › Liste des opérations de recette et de dépense (VIDR)
--                 Cheminement exact absent des manuels — probable écran VIDR.
--
-- ⚠ SQL À FOURNIR — colonnes attendues (alias exacts, format VIDR, 19) :
--   C_PCA, D_CPTA, N_REGL, N_LIG_R, C_TYP_OP, N_OP, C_GUIC, N_MATTIR,
--   L_NP, C_OPE, C_IT, C_NAT, C_REF1, C_REF2, M_REGL, C_NOP, C_MDR,
--   N_CHEQ, C_CAIS
--
-- Données d'entrée :
--   :d_debut  — 1er janvier de l'exercice (chaîne DD/MM/YYYY)
--   :d_fin    — date de situation / fin de période (chaîne DD/MM/YYYY)
--
-- Résumé : opérations IG sur les comptes de recettes fiscales
-- (préfixes 1812, 4781, 4783) pour l'appariement transferts ↔ prises en charge
-- et la ventilation par nature (codes RF).
-- Contrôle import : prises en charge sans nature (C_NAT vide) signalées.
-- Montants en FCFA. Modèle des autres requêtes VIDR (crédits délégués, TVA IG…).
--
-- Remplacer le SELECT ci-dessous par la requête VIDR réelle.

SELECT
    CAST(NULL AS VARCHAR2(16))  AS C_PCA,
    CAST(NULL AS DATE)          AS D_CPTA,
    CAST(NULL AS VARCHAR2(32))  AS N_REGL,
    CAST(NULL AS NUMBER(10))    AS N_LIG_R,
    CAST(NULL AS VARCHAR2(8))   AS C_TYP_OP,
    CAST(NULL AS VARCHAR2(32))  AS N_OP,
    CAST(NULL AS VARCHAR2(16))  AS C_GUIC,
    CAST(NULL AS VARCHAR2(64))  AS N_MATTIR,
    CAST(NULL AS VARCHAR2(255)) AS L_NP,
    CAST(NULL AS VARCHAR2(16))  AS C_OPE,
    CAST(NULL AS VARCHAR2(32))  AS C_IT,
    CAST(NULL AS VARCHAR2(16))  AS C_NAT,
    CAST(NULL AS VARCHAR2(64))  AS C_REF1,
    CAST(NULL AS VARCHAR2(64))  AS C_REF2,
    CAST(NULL AS NUMBER(20,2))  AS M_REGL,
    CAST(NULL AS VARCHAR2(8))   AS C_NOP,
    CAST(NULL AS VARCHAR2(16))  AS C_MDR,
    CAST(NULL AS VARCHAR2(64))  AS N_CHEQ,
    CAST(NULL AS VARCHAR2(16))  AS C_CAIS
FROM DUAL
WHERE 1 = 0
  AND TO_DATE(:d_debut, 'DD/MM/YYYY') IS NOT NULL
  AND TO_DATE(:d_fin, 'DD/MM/YYYY') IS NOT NULL
;

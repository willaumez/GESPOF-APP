-- Connexion: Oracle (lecture seule) — Service des Opérations Financières
--
-- F1 · Mouvements de fonds et effets (comptes 181*, 581* à 584*).
-- Source métier : IG › Liste des opérations de recette et de dépense (VIDR)
--                 Trois extractions (feuilles « Feuille 1 » à « Feuille 1 (3) »)
--                 pour alimenter la feuille MVM_FE du RD Model Automatisé.
--
-- ⚠ SQL À FOURNIR — colonnes attendues (alias exacts, format VIDR, 19) :
--   C_PCA, D_CPTA, N_REGL, N_LIG_R, C_TYP_OP, N_OP, C_GUIC, N_MATTIR,
--   L_NP, C_OPE, C_IT, C_NAT, C_REF1, C_REF2, M_REGL, C_NOP, C_MDR,
--   N_CHEQ, C_CAIS
--
-- Données d'entrée :
--   :d_debut  — 1er janvier de l'exercice (chaîne DD/MM/YYYY)
--   :d_fin    — date de situation / fin de période (chaîne DD/MM/YYYY)
--   :compte   — préfixe de compte (ex. '181%', '581%', '582%', '583%', '584%')
--
-- Résumé : opérations IG des comptes de mouvements de fonds et effets.
-- Les comptes exacts (181*, 581–584*) restent à confirmer avec le Chef SOF.
-- Regroupements attendus côté SROT : 181, 582, 583, 584.
-- Montants en FCFA. Trois lots d'extraction possibles (un par famille de comptes).
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
  AND :compte IS NOT NULL
;

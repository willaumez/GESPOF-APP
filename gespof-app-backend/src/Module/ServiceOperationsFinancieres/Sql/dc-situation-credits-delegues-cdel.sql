-- Connexion: Oracle (lecture seule) — Service des Opérations Financières
--
-- F6 · Situation des crédits délégués (équivalent export CDEL).
-- Source métier : DC › Suivi Règlements › Situation des crédits délégués
-- Fichier de référence : Procédures SOF\brute\RAP\CDEL.xlsx
-- Manuel : SOF p. 7
--
-- ⚠ SQL À FOURNIR — colonnes attendues (alias exacts, 11) :
--   PC, N_AD, MINISTERE, MISSION, PROGRAMME, ACTION, TITRE, BOP, UO,
--   MONTANT, RESTE_A_PAYER
--   (écran maquette : « N° AD », « MINISTÈRE », « RESTE À PAYER »
--    → alias SQL N_AD, MINISTERE, RESTE_A_PAYER)
--
-- Données d'entrée :
--   :exercice — année d'exercice (ex. 2026)
--   :pc       — poste comptable ; NULL ou '*' = tous les postes
--
-- Résumé : situation des AD (crédits délégués) avec montant et reste à payer.
-- Contrôle import : reste à payer négatif signalé.
-- Montants en FCFA.
--
-- Remplacer le SELECT ci-dessous par la requête CDEL réelle.

SELECT
    CAST(NULL AS VARCHAR2(16))  AS PC,
    CAST(NULL AS VARCHAR2(64))  AS N_AD,
    CAST(NULL AS VARCHAR2(255)) AS MINISTERE,
    CAST(NULL AS VARCHAR2(255)) AS MISSION,
    CAST(NULL AS VARCHAR2(255)) AS PROGRAMME,
    CAST(NULL AS VARCHAR2(255)) AS ACTION,
    CAST(NULL AS VARCHAR2(16))  AS TITRE,
    CAST(NULL AS VARCHAR2(32))  AS BOP,
    CAST(NULL AS VARCHAR2(32))  AS UO,
    CAST(NULL AS NUMBER(20,2))  AS MONTANT,
    CAST(NULL AS NUMBER(20,2))  AS RESTE_A_PAYER
FROM DUAL
WHERE 1 = 0
  AND :exercice IS NOT NULL
;

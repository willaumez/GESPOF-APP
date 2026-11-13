-- Connexion: Oracle (lecture seule) — Service des Opérations Financières
--
-- F14 · RAP sur ordonnances en mode BOP (équivalent export XRAV).
-- Source métier : DC › Suivi Règlements › Statistiques Règlements
--                 › Export EXCEL des RAP sur Ordos en Mode BOP
-- Fichier de référence : Procédures SOF\brute\RAP\RAP mode BOP.xlsx
-- Manuel : SOF p. 5-6 (écran p. 6 = RAP, pas règlements)
--
-- ⚠ SQL À FOURNIR — colonnes attendues (alias exacts, 10) :
--   ORDONNANCE, D_EMIS, ECHEANCE, EX, C_CATEG, TIT, NAT, MDR, M_BRUT, RAP
--   (écran maquette : ECHÉANCE → alias SQL ECHEANCE)
--
-- Données d'entrée :
--   :d_debut  — émission début (souvent 01/01/2014, chaîne DD/MM/YYYY)
--   :d_fin    — date de situation (chaîne DD/MM/YYYY)
--
-- Résumé : restes à payer sur ordonnances en mode BOP.
-- Paramètres écran : Disponibilité « TOUTES » ; Catégorie, Type de dépense
-- et Origine « TOUS LES RÈGLEMENTS » ; F7.
-- Contrôle import : catégorie hors TPG, AGC, ENT signalée.
-- Montants en FCFA.
--
-- Remplacer le SELECT ci-dessous par la requête XRAV réelle.

SELECT
    CAST(NULL AS VARCHAR2(32))  AS ORDONNANCE,
    CAST(NULL AS DATE)          AS D_EMIS,
    CAST(NULL AS DATE)          AS ECHEANCE,
    CAST(NULL AS VARCHAR2(8))   AS EX,
    CAST(NULL AS VARCHAR2(16))  AS C_CATEG,
    CAST(NULL AS VARCHAR2(16))  AS TIT,
    CAST(NULL AS VARCHAR2(16))  AS NAT,
    CAST(NULL AS VARCHAR2(16))  AS MDR,
    CAST(NULL AS NUMBER(20,2))  AS M_BRUT,
    CAST(NULL AS NUMBER(20,2))  AS RAP
FROM DUAL
WHERE 1 = 0
  AND TO_DATE(:d_debut, 'DD/MM/YYYY') IS NOT NULL
  AND TO_DATE(:d_fin, 'DD/MM/YYYY') IS NOT NULL
;

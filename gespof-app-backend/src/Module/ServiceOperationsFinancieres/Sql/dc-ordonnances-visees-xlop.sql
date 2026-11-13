-- Connexion: Oracle (lecture seule) — Service des Opérations Financières
--
-- F3 · Ordonnances visées (équivalent export XLOP).
-- Source métier : DC › Suivi Règlements › Statistiques Règlements
--                 › Export EXCEL des Ordonnances Visées
-- Fichier de référence : Procédures SOF\brute\Execution_Dep\ORDOS.xlsx
-- Manuel : SOF p. 12-13
--
-- ⚠ SQL À FOURNIR — colonnes attendues (alias exacts, 18) :
--   ECHEANCE, EX, ORDONNANCE, N_LIG, D_EMIS, MIN, MIS, PROG, ACT,
--   TIT, BOP, UO, PC, NAT, MDR, MATRIC, NOM, M_BRUT
--   (écran maquette : ECHÉANCE → alias SQL ECHEANCE)
--
-- Données d'entrée :
--   :d_debut  — 1er janvier de l'exercice d'émission (chaîne DD/MM/YYYY)
--   :d_fin    — date de situation / fin (chaîne DD/MM/YYYY)
--   :ex       — exercice d'imputation (année, ex. 2026)
--
-- Résumé : liste des ordonnances reçues / visées.
-- Paramètres écran : Disponibilité « TOUTES » ; Catégorie et Type
-- « TOUS LES RÈGLEMENTS » ; Origine « ORDONNANCES VISÉES » ; F7.
-- Alerte côté import si le nombre de lignes chute fortement vs lot précédent.
-- Montants en FCFA.
--
-- Remplacer le SELECT ci-dessous par la requête XLOP réelle.

SELECT
    CAST(NULL AS DATE)          AS ECHEANCE,
    CAST(NULL AS VARCHAR2(8))   AS EX,
    CAST(NULL AS VARCHAR2(32))  AS ORDONNANCE,
    CAST(NULL AS NUMBER(10))    AS N_LIG,
    CAST(NULL AS DATE)          AS D_EMIS,
    CAST(NULL AS VARCHAR2(16))  AS MIN,
    CAST(NULL AS VARCHAR2(32))  AS MIS,
    CAST(NULL AS VARCHAR2(32))  AS PROG,
    CAST(NULL AS VARCHAR2(32))  AS ACT,
    CAST(NULL AS VARCHAR2(16))  AS TIT,
    CAST(NULL AS VARCHAR2(32))  AS BOP,
    CAST(NULL AS VARCHAR2(32))  AS UO,
    CAST(NULL AS VARCHAR2(16))  AS PC,
    CAST(NULL AS VARCHAR2(16))  AS NAT,
    CAST(NULL AS VARCHAR2(16))  AS MDR,
    CAST(NULL AS VARCHAR2(64))  AS MATRIC,
    CAST(NULL AS VARCHAR2(255)) AS NOM,
    CAST(NULL AS NUMBER(20,2))  AS M_BRUT
FROM DUAL
WHERE 1 = 0
  AND TO_DATE(:d_debut, 'DD/MM/YYYY') IS NOT NULL
  AND TO_DATE(:d_fin, 'DD/MM/YYYY') IS NOT NULL
  AND :ex IS NOT NULL
;

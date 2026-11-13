-- Connexion: Oracle (lecture seule) — Service des Opérations Financières
--
-- RAP avant BOP (format à définir — pas d'écran Oracle dans les manuels).
-- Source métier : fichier fixe fourni (RAP avant BOP.xlsx) — dépôt Excel.
-- Format d'import maquette : dc-rap-avant-bop (nop: true — pas d'extraction Oracle).
--
-- ⚠ SQL OPTIONNEL / À FOURNIR si une extraction Oracle est identifiée —
-- colonnes attendues (alias exacts, 12) :
--   ORDONNANCE, D_EMIS, ECHEANCE, EX, C_CATEG, TIT, NAT, MDR,
--   M_BRUT, RAP, MINISTERE, NATURE
--   (écran : ECHÉANCE, MINISTÈRE → ECHEANCE, MINISTERE)
--
-- Données d'entrée (si extraction un jour disponible) :
--   :d_debut  — émission début (chaîne DD/MM/YYYY)
--   :d_fin    — date de situation (chaîne DD/MM/YYYY)
--
-- Résumé : restes à payer avant passage en mode BOP.
-- Format différent du RAP mode BOP (colonnes MINISTERE, NATURE en plus).
-- Contrôle import : format différent du BOP signalé.
-- Voie de référence actuelle : dépôt du fichier fixe, pas d'Oracle.
--
-- Remplacer le SELECT ci-dessous uniquement si un écran Oracle est confirmé.

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
    CAST(NULL AS NUMBER(20,2))  AS RAP,
    CAST(NULL AS VARCHAR2(255)) AS MINISTERE,
    CAST(NULL AS VARCHAR2(255)) AS NATURE
FROM DUAL
WHERE 1 = 0
  AND TO_DATE(:d_debut, 'DD/MM/YYYY') IS NOT NULL
  AND TO_DATE(:d_fin, 'DD/MM/YYYY') IS NOT NULL
;

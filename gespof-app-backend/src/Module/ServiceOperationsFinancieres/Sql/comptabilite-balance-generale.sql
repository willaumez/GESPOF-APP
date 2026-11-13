-- Connexion: Oracle (lecture seule) — Service des Opérations Financières
--
-- F13 · Balance générale mensuelle.
-- Source métier : Comptabilité (cheminement écran à identifier — absent des manuels).
-- Format d'import maquette : cpt-balance.
--
-- ⚠ SQL À FOURNIR — colonnes attendues (alias exacts, 11) :
--   COMPTE, LIBELLE, SOLDE_ENTREE, SENS, DEBITS_ANT, CREDITS_ANT,
--   DEBITS_MOIS, CREDITS_MOIS, DEBITS_ARRETES, CREDITS_ARRETES, NOUVEAU_SOLDE
--   (libellés écran : LIBELLÉ, SOLDE ENTRÉE, DÉBITS ANT., CRÉDITS ANT.,
--    DÉBITS MOIS, CRÉDITS MOIS, DÉBITS ARRÊTÉS, CRÉDITS ARRÊTÉS, NOUVEAU SOLDE)
--
-- Données d'entrée :
--   :exercice — année d'exercice
--   :mois     — mois de la balance (1–12)
--
-- Résumé : balance générale du mois pour le TOFE / rapports.
-- Contrôle import : total débits = total crédits.
-- Montants en FCFA.
--
-- Remplacer le SELECT ci-dessous par la requête réelle une fois l'écran identifié.

SELECT
    CAST(NULL AS VARCHAR2(32))  AS COMPTE,
    CAST(NULL AS VARCHAR2(255)) AS LIBELLE,
    CAST(NULL AS NUMBER(20,2))  AS SOLDE_ENTREE,
    CAST(NULL AS VARCHAR2(8))   AS SENS,
    CAST(NULL AS NUMBER(20,2))  AS DEBITS_ANT,
    CAST(NULL AS NUMBER(20,2))  AS CREDITS_ANT,
    CAST(NULL AS NUMBER(20,2))  AS DEBITS_MOIS,
    CAST(NULL AS NUMBER(20,2))  AS CREDITS_MOIS,
    CAST(NULL AS NUMBER(20,2))  AS DEBITS_ARRETES,
    CAST(NULL AS NUMBER(20,2))  AS CREDITS_ARRETES,
    CAST(NULL AS NUMBER(20,2))  AS NOUVEAU_SOLDE
FROM DUAL
WHERE 1 = 0
  AND :exercice IS NOT NULL
  AND :mois IS NOT NULL
;

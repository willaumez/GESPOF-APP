-- Connexion: Oracle (lecture seule) — Service des Opérations Financières
--
-- États de liquidation des dépenses (déversements IG).
-- Table: GTR.LIQD_RECAP
--
-- Trois états liquidatifs renseignent les états financiers :
--   1. Solde permanente     — Direction de la Dépense  (ex. SOLDE ETAT)
--   2. Main d'œuvre non-permanente (MONP) — Direction de la Dépense
--      (non filtrée ici : à rapprocher des états fournis par le service)
--   3. Pension              — CPPF                     (ex. PENSIONS)
--
-- Les montants solde / pension se vérifient via le menu des déversements
-- de dépense dans IG : choisir « SOLDE ETAT » ou « PENSIONS » puis Afficher.
-- En cas d'écart avec les états, privilégier les données IG après contrôle
-- auprès des services concernés.
--
-- Données d'entrée :
--   :d_debut  — date de début (chaîne DD/MM/YYYY)
--   :d_fin    — date de fin (chaîne DD/MM/YYYY)

SELECT r.c_dev,
       r.l_dev,
       r.d_dev,
       r.d_valeur,
       r.nombre,
       r.m_brut,
       r.m_net,
       r.d_valid
FROM   GTR.LIQD_RECAP r
WHERE  r.d_dev BETWEEN TO_DATE(:d_debut, 'DD/MM/YYYY') AND TO_DATE(:d_fin, 'DD/MM/YYYY')
ORDER  BY r.d_dev, r.c_dev;

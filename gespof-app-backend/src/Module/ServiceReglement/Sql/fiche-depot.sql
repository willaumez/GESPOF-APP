-- Connexion: sgp (Oracle, lecture seule) — Service des Règlements
--
-- 1) Fiche de dépôt du jour (lots SYSTAC).
-- Vue: v_recap_dsgp
-- Paramètre: :d_presentation (chaîne DD/MM/YYYY) — un seul jour

SELECT
    C_ORIG              AS "C_ORIG",
    D_PRESENTATION      AS "D_PRESENTATION",
    L_ORIG              AS "L_ORIG",
    N_BV                AS "N_BV",
    NB_REGL             AS "NB_REGL",
    MONTANT_SYSTAC      AS "MONTANT_SYSTAC",
    NB_REGL_SYGMA       AS "NB_REGL_SYGMA",
    MONTANT_SYGMA       AS "MONTANT_SYGMA",
    D_CREATION_IP       AS "D_CREATION_IP",
    D_ARRET_IP          AS "D_GENERATION"
FROM v_recap_dsgp
WHERE d_valeur IS NOT NULL
  AND d_presentation >= TO_DATE(:d_presentation, 'DD/MM/YYYY')
  AND d_presentation <= TO_DATE(:d_presentation, 'DD/MM/YYYY')
  AND montant_systac > 0
  AND d_creation_ip IS NOT NULL
  AND d_arret_ip IS NOT NULL
ORDER BY n_ordre, n_bv

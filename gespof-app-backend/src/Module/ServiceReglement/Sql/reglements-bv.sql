-- Connexion: sgp (Oracle, lecture seule) — Service des Règlements
--
-- 2) Règlements d'une liste de BV.
-- Table: dmc.regt (toujours préfixer par dmc. — gtr.regt / djadja.regt sont des homonymes vides)
-- Placeholder: {{n_bv_list}} — le PHP génère :n_bv_0, :n_bv_1, … (oci8 ne bind pas un tableau IN)

SELECT
    n_bv            AS "N_BV",
    n_emis          AS "Numero_emission",
    n_regl          AS "N_Regl",
    (m_regl - m_prec_tva) AS "Net_a_Payer"
FROM dmc.regt
WHERE n_bv IN ({{n_bv_list}})
ORDER BY n_bv, n_emis

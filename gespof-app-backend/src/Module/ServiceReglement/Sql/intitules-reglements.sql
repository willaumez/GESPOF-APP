-- Connexion: sgp (Oracle, lecture seule) — Service des Règlements
--
-- 3) Intitulé (L_INTCPT) d'un règlement, par paire (n_emis, n_regl).
-- Table: dmc.regt
-- Placeholder: {{i}} — le PHP répète ce bloc en UNION ALL (un bind par paire).
--
-- Ne PAS écrire "(n_emis, n_regl) IN ((a,b),…)" ni des OR chaînés : Oracle ignore
-- alors l'index (full scan, timeout). Une égalité simple par paire est instantanée.

SELECT n_emis AS "Numero_emission", n_regl AS "N_Regl", l_intcpt AS "Intitule"
FROM dmc.regt
WHERE n_emis = :n_emis_{{i}} AND n_regl = :n_regl_{{i}}

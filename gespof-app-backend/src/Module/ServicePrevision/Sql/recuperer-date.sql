-- Connexion: Oracle (lecture seule) — Service de Prévision
--
-- Récupérer les dates d'ouverture, sessions et libellés du poste de travail.
-- Tables: cais, ptra
-- Filtres: c_pca = 1130, c_ptra = 'X1130' (5 dates comptables les plus récentes)
-- ROWNUM s'applique avant ORDER BY : d'où la sous-requête.

SELECT DATE_OUVERTURE, N_SESSION, CODE, LIBELLE
FROM (
    SELECT c.D_CPTA AS DATE_OUVERTURE,
           c.N_SESS AS N_SESSION,
           p.C_PTRA AS CODE,
           p.L_PTRA AS LIBELLE
    FROM gtr.cais c
    JOIN gtr.ptra p ON p.c_pca = c.c_pca AND p.c_ptra = c.c_ptra
    WHERE c.c_pca = 1130
      AND c.c_ptra = 'X1130'
    ORDER BY c.D_CPTA DESC
)
WHERE ROWNUM <= 3

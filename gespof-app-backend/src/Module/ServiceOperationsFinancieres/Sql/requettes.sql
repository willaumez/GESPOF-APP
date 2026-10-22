-- Connexion: Oracle (lecture seule) — Service des Opérations Financières
--
-- Recettes douanières (modèle automatisé).
-- Deux requêtes distinctes : (1) comptes hors RUSID  (2) RUSID 4663-218.
--
-- =====================================================================
-- 1. Comptes hors RUSID
--    Tables: GTR.DOPE, GTR.LREG, GTR.REGL, GTR.OPER, GTR.GUIC, GTR.CAIS, GTR.CONT
--
--    L'extraction se fait compte par compte (un bind :compte à la fois).
--    Chaque compte alimente la colonne DOMF de l'état (exemple : 4784-101).
--
--    Données d'entrée :
--      :date_deb  — date de début (borne inclusive)
--      :date_fin  — date de fin (borne inclusive)
--      :compte    — un seul compte, hors RUSID (ex. 4784-101)
--
--    Remarques :
--      i.  Comptes 4784-1* : opérations bancaires uniquement (c_nop = 'B').
--      ii. RUSID (4663-218) : exclue ici — voir requête 2 ci-dessous.
--          Tous les autres comptes : numéraire et bancaire (c_nop IN ('N', 'B')).
-- =====================================================================


WITH param AS (
    SELECT TO_DATE(:date_deb, 'DD/MM/YYYY')   AS date_deb,
           TO_DATE(:date_fin, 'DD/MM/YYYY')   AS date_fin,
           :compte                             AS compte
    FROM dual
)
SELECT regl.c_pca,
       oper.n_op,
       guic.c_ptra                            AS c_guic,
       oper.n_mattir,
       cont.l_nom                             AS l_tiers,   -- corrigé (c_mattir n'existe pas sur CONT)
       regl.l_pv                              AS l_np,
       dope.n_lig_op,
       dope.c_ope,
       dope.c_it,
       dope.c_nat,
       dope.c_ref1,
       dope.c_ref2,
       dope.m_oper,
       regl.n_regl,
       lreg.n_lig                             AS n_lig_r,
       lreg.m_lig                             AS m_regl,
       regl.c_nop,
       regl.c_modreg                          AS c_mdr,
       regl.n_cheq,
       regl.d_cpta,
       cais.c_ptra                            AS c_cais
FROM   GTR.DOPE dope
JOIN   GTR.LREG lreg ON lreg.c_pca = dope.c_pca AND lreg.n_op = dope.n_op
                     AND lreg.n_lig_op = dope.n_lig_op AND lreg.d_cpta = dope.d_cpta
JOIN   GTR.REGL regl ON regl.c_pca = lreg.c_pca AND regl.n_regl = lreg.n_regl
                     AND regl.d_cpta = lreg.d_cpta
JOIN   GTR.OPER oper ON oper.c_pca = regl.c_pca AND oper.n_op = regl.n_op
                     AND oper.d_cpta = regl.d_cpta
JOIN   GTR.GUIC guic ON guic.c_pca = oper.c_pca AND guic.n_sess = oper.n_sess
                     AND guic.d_cpta = oper.d_cpta
JOIN   GTR.CAIS cais ON cais.c_pca = regl.c_pca AND cais.n_sess = regl.n_sess
                     AND cais.d_cpta = regl.d_cpta
JOIN   GTR.CONT cont ON cont.n_mattir = oper.n_mattir
CROSS JOIN param p
WHERE  dope.c_typ_det = 'R'
AND    dope.d_cpta BETWEEN p.date_deb AND p.date_fin
AND    dope.c_it = p.compte
AND    dope.c_it <> '4663-218'
AND    (
          (dope.c_it LIKE '4784-1%' AND regl.c_nop = 'B')
       OR (dope.c_it NOT LIKE '4784-1%' AND regl.c_nop IN ('N', 'B'))
       )
ORDER  BY regl.c_pca, dope.d_cpta, regl.n_regl, lreg.n_lig;

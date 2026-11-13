-- Connexion: Oracle (lecture seule) — Service des Opérations Financières
--
-- Dépenses / règlements TVA-IG — Compte 4781-31 / Nature 81.
-- Tables: GTR.DOPE, GTR.LREG, GTR.REGL, GTR.OPER, GTR.GUIC, GTR.CAIS, GTR.CONT
--
-- Données d'entrée :
--   Nature des opérations     — dépenses (c_typ_det = 'D', figé)
--   Disponibilités            — numéraire et bancaire (c_nop IN ('N', 'B'), figé)
--   Compte balance            — 4781-31 (figé)
--   Nature                    — 81 (figé)
--   :d_debut                  — 1er janvier de l'exercice (chaîne DD/MM/YYYY)
--   :d_fin                    — jour de confection des états financiers (chaîne DD/MM/YYYY)
--
-- Exemple d'exercice : 01/01/2024 au 31/12/2024

SELECT regl.c_pca,
       oper.n_op,
       guic.c_ptra                                        AS c_guic,
       oper.n_mattir,
       cont.c_mattir,
       regl.l_pv                                          AS l_np,
       dope.n_lig_op,
       dope.c_ope,
       dope.c_it,
       dope.c_nat,
       dope.c_ref1,
       dope.c_ref2,
       dope.m_oper,
       regl.n_regl,
       lreg.n_lig                                         AS n_lig_r,
       lreg.m_lig                                         AS m_regl,
       regl.c_nop,
       regl.c_modreg                                      AS c_mdr,
       regl.n_cheq,
       regl.d_cpta,
       cais.c_ptra                                        AS c_cais
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
WHERE  dope.c_typ_det = 'D'
AND    dope.c_it      = '4781-31'
AND    dope.c_nat     = 81
AND    dope.d_cpta BETWEEN TO_DATE(:d_debut, 'DD/MM/YYYY') AND TO_DATE(:d_fin, 'DD/MM/YYYY')
AND    regl.c_nop IN ('N', 'B')
ORDER  BY regl.c_pca, dope.d_cpta, regl.n_regl, lreg.n_lig;

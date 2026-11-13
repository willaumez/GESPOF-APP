-- Connexion: Oracle (lecture seule) — Service des Opérations Financières
--
-- Requête VIDR unique (format F1) — remplace les stubs comptes/natures figés :
--   depenses-reglements-credits-delegues.sql
--   depenses-avances-budget-etat.sql
--   depenses-avances-budget-poste.sql
--   depenses-reglements-tva-ig.sql
--
-- Tables: GTR.DOPE, GTR.LREG, GTR.REGL, GTR.OPER, GTR.GUIC, GTR.CAIS, GTR.CONT
--
-- Binds :
--   :d_debut, :d_fin              — période (DD/MM/YYYY)
--   :types_operation              — ex. 'D' (liste via placeholder {{types_list}})
--   :disponibilites               — ex. 'N','B' ({{dispos_list}})
--   :comptes                      — motifs LIKE ({{comptes_like_list}} → dope.c_it LIKE :c0 OR …)
--   :natures                      — optionnel ({{natures_list}}) ; si vide, filtre nature omis
--
-- Colonnes F1 (ordre) : C_PCA, D_CPTA, N_REGL, N_LIG_R, C_TYP_OP, N_OP, N_LIG_OP,
--   C_GUIC, N_MATTIR, L_NP, C_OPE, C_IT, C_NAT, C_REF1, C_REF2, M_REGL, C_NOP, C_MDR, N_CHEQ, C_CAIS

SELECT regl.c_pca                                          AS c_pca,
       regl.d_cpta                                         AS d_cpta,
       regl.n_regl                                         AS n_regl,
       lreg.n_lig                                          AS n_lig_r,
       dope.c_typ_det                                      AS c_typ_op,
       oper.n_op                                           AS n_op,
       dope.n_lig_op                                       AS n_lig_op,
       guic.c_ptra                                         AS c_guic,
       oper.n_mattir                                       AS n_mattir,
       regl.l_pv                                           AS l_np,
       dope.c_ope                                          AS c_ope,
       dope.c_it                                           AS c_it,
       dope.c_nat                                          AS c_nat,
       dope.c_ref1                                         AS c_ref1,
       dope.c_ref2                                         AS c_ref2,
       lreg.m_lig                                          AS m_regl,
       regl.c_nop                                          AS c_nop,
       regl.c_modreg                                       AS c_mdr,
       regl.n_cheq                                         AS n_cheq,
       cais.c_ptra                                         AS c_cais
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
LEFT JOIN GTR.CONT cont ON cont.n_mattir = oper.n_mattir
WHERE  dope.c_typ_det IN ({{types_list}})
AND    ({{comptes_like_pred}})
AND    dope.d_cpta BETWEEN TO_DATE(:d_debut, 'DD/MM/YYYY') AND TO_DATE(:d_fin, 'DD/MM/YYYY')
AND    regl.c_nop IN ({{dispos_list}})
AND    ({{natures_pred}})
ORDER  BY regl.c_pca, dope.d_cpta, regl.n_regl, lreg.n_lig;

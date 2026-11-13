-- Connexion: Oracle (lecture seule) — Service des Opérations Financières
--
-- Recettes pétrolières — opérations IG (format F1 / VIDR).
-- À clarifier vs les extractions dédiées :
--   model-automatise-recettes-petroliere-1812-201.sql
--   model-automatise-recettes-petroliere-etat-par-compte.sql
-- Peut être la VIDR générique multi-comptes ou un doublon des deux précédentes.
--
-- Tables: GTR.DOPE, GTR.LREG, GTR.REGL, GTR.OPER, GTR.GUIC, GTR.CAIS, GTR.CONT
--
-- Données d'entrée :
--   :date_debut     — 1er du mois (DD/MM/YYYY)
--   :date_fin       — date de situation (DD/MM/YYYY)
--   {{comptes_list}} — ex. :compte_0, :compte_1 (bind oci8)
--
-- Numéraire et bancaire (c_nop IN ('N','B')).
-- Compte 1812-201 : les lignes N/A sont filtrées côté PHP / nature.

WITH param AS (
    SELECT TO_DATE(:date_debut, 'DD/MM/YYYY') AS date_debut,
           TO_DATE(:date_fin, 'DD/MM/YYYY')   AS date_fin
    FROM dual
),
dope_f AS (
    SELECT dope.c_pca,
           dope.n_op,
           dope.n_lig_op,
           dope.d_cpta,
           dope.c_ope,
           dope.c_it,
           dope.c_nat,
           dope.c_ref1,
           dope.c_ref2,
           dope.m_oper,
           dope.c_typ_det
    FROM   GTR.DOPE dope
    CROSS JOIN param p
    WHERE  dope.c_typ_det IN ('X', 'S')
    AND    dope.c_it IN ({{comptes_list}})
    AND    dope.d_cpta >= p.date_debut
    AND    dope.d_cpta <  p.date_fin + 1
)
SELECT regl.c_pca,
       regl.d_cpta,
       regl.n_regl,
       lreg.n_lig                             AS n_lig_r,
       dope.c_typ_det                         AS c_typ_op,
       oper.n_op,
       guic.c_ptra                            AS c_guic,
       oper.n_mattir,
       regl.l_pv                              AS l_np,
       dope.c_ope,
       dope.c_it,
       dope.c_nat,
       dope.c_ref1,
       dope.c_ref2,
       lreg.m_lig                             AS m_regl,
       regl.c_nop,
       regl.c_modreg                          AS c_mdr,
       regl.n_cheq,
       cais.c_ptra                            AS c_cais,
       cont.l_nom                             AS l_tiers
FROM   dope_f dope
JOIN   GTR.LREG lreg ON lreg.c_pca     = dope.c_pca
                    AND lreg.n_op      = dope.n_op
                    AND lreg.n_lig_op  = dope.n_lig_op
                    AND lreg.d_cpta    = dope.d_cpta
JOIN   GTR.REGL regl ON regl.c_pca     = lreg.c_pca
                    AND regl.n_regl    = lreg.n_regl
                    AND regl.d_cpta    = lreg.d_cpta
JOIN   GTR.OPER oper ON oper.c_pca     = regl.c_pca
                    AND oper.n_op      = regl.n_op
                    AND oper.d_cpta    = regl.d_cpta
JOIN   GTR.GUIC guic ON guic.c_pca     = oper.c_pca
                    AND guic.n_sess    = oper.n_sess
                    AND guic.d_cpta    = oper.d_cpta
JOIN   GTR.CAIS cais ON cais.c_pca     = regl.c_pca
                    AND cais.n_sess    = regl.n_sess
                    AND cais.d_cpta    = regl.d_cpta
JOIN   GTR.CONT cont ON cont.n_mattir  = oper.n_mattir
WHERE  regl.c_nop IN ('N', 'B')
ORDER  BY dope.c_it, dope.c_nat, regl.d_cpta, regl.n_regl, lreg.n_lig;

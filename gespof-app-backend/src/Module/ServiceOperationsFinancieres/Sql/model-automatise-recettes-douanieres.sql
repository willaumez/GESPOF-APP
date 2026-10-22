-- Connexion: Oracle (lecture seule) — Service des Opérations Financières
--
-- Recettes douanières (modèle automatisé).
-- Deux requêtes distinctes : (1) comptes hors RUSID  (2) RUSID 4663-218.
--CREATE INDEX GTR.IDX_DOPE_CIT_DCPTA
--ON GTR.DOPE (c_it, d_cpta);
-- =====================================================================
-- 1. Comptes hors RUSID
--    Tables: GTR.DOPE, GTR.LREG, GTR.REGL, GTR.OPER, GTR.GUIC, GTR.CAIS, GTR.CONT
--
--    L'extraction accepte une liste de comptes (placeholder {{comptes_list}}).
--    Le PHP génère :compte_0, :compte_1, … (oci8 ne bind pas un tableau IN).
--    CTE dope_f : filtre DOPE (compte + période) avant les jointures coûteuses.
--    Résultat trié par compte (dope.c_it).
--
--    Données d'entrée :
--      :date_deb       — date de début (borne inclusive)
--      :date_fin       — date de fin (borne inclusive)
--      {{comptes_list}} — liste de comptes hors RUSID (ex. :compte_0, :compte_1)
--
--    Remarques :
--      i.  Comptes 4784-1* : opérations bancaires uniquement (c_nop = 'B').
--      ii. RUSID (4663-218) : exclue ici (filtre explicite) — voir requête 2.
--          Tous les autres comptes : numéraire et bancaire (c_nop IN ('N', 'B')).
-- =====================================================================
WITH param AS (
    SELECT TO_DATE(:date_deb, 'DD/MM/YYYY') AS date_deb,
           TO_DATE(:date_fin, 'DD/MM/YYYY') AS date_fin
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
           dope.m_oper
    FROM   GTR.DOPE dope
    CROSS JOIN param p
    WHERE  dope.c_typ_det IN ('X', 'S')
    AND    dope.c_it IN ({{comptes_list}})
    AND    dope.c_it <> '4663-218'
    AND    dope.d_cpta >= p.date_deb
    AND    dope.d_cpta <  p.date_fin + 1
)
SELECT regl.c_pca,
       oper.n_op,
       guic.c_ptra                            AS c_guic,
       oper.n_mattir,
       cont.l_nom                             AS l_tiers,
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
WHERE  (
          (dope.c_it LIKE '4784-1%' AND regl.c_nop = 'B')
       OR (dope.c_it NOT LIKE '4784-1%' AND regl.c_nop IN ('N', 'B'))
       )
ORDER  BY dope.c_it, regl.c_pca, dope.d_cpta, regl.n_regl, lreg.n_lig;


-- =====================================================================
-- 2. RUSID (compte 4663-218)
--    Tables: GTR.V_FMI, GTR.PCAG, GTR.VBAL
--            (schémas V_FMI / PCAG à confirmer via ALL_OBJECTS)
--
--    Données d'entrée :
--      :date_deb  — date de début (borne inclusive, comme la requête 1)
--      :date_fin  — date de fin (borne inclusive, comme la requête 1)
--      Compte     — 4663-218 (figé)
--
--    Montants exprimés en millions (sum(m_regl) / 1000000).
--    Type d'opération figé sur RECETTES.
-- =====================================================================

SELECT to_number(to_char(v.d_cpta, 'MM'))                             AS mm,
       decode(to_char(v.d_cpta, 'MM'),
              '01', 'Janvier', '02', 'Février', '03', 'Mars', '04', 'Avril',
              '05', 'Mai', '06', 'Juin', '07', 'Juillet', '08', 'Août',
              '09', 'Septembre', '10', 'Octobre', '11', 'Novembre', '12', 'Décembre',
              to_char(v.d_cpta, 'MM'))                                 AS mois,
       lpad(v.c_pc, 3, '0')                                           AS c_pca,
       decode(substr(p.l_pca, 1, 4),
              'TP. ', replace(p.l_pca, 'TP. ', ''),
              'T.P.', replace(p.l_pca, 'T.P.', ''),
              'R.P.', replace(p.l_pca, 'R.P.', ''),
              'RP. ', replace(p.l_pca, 'RP. ', ''),
              p.l_pca)                                                AS libelle,
       v.c_it,
       c.l_it || c.l_it_l                                             AS l_compte,
       sum(v.m_regl) / 1000000                                        AS m_oper,
       decode(v.c_typ_regl, 'D', 'DEPENSES', 'RECETTES')              AS operation
FROM   GTR.V_FMI v,
       GTR.PCAG  p,
       GTR.VBAL  c
WHERE  v.c_pc = p.c_pca
AND    v.c_it = c.c_it
AND    v.c_typ_regl = 'RECETTES'
AND    v.d_cpta >= TO_DATE(:date_deb, 'DD/MM/YYYY')
AND    v.d_cpta <  TO_DATE(:date_fin, 'DD/MM/YYYY') + 1
AND    v.c_it = '4663-218'
GROUP BY to_char(v.d_cpta, 'MM'), v.c_pc, p.l_pca, c.l_it || c.l_it_l, v.c_typ_regl, v.c_it
ORDER BY to_number(to_char(v.d_cpta, 'MM')), v.c_pc, p.l_pca;

-- Connexion: Oracle (lecture seule) — Service des Opérations Financières
--
-- Recettes pétrolières — étape B : extraction du compte 1812-201
-- (numéraire et bancaire — lignes détaillées DOPE).
--
-- Les lignes N/A (transactions hors compagnies contribuables) sont exclues.
-- Les lignes conservées correspondent en pratique à des « Transferts » :
-- chaque montant doit ensuite être rapproché d’OP BEAC pour en déterminer
-- le type (IS, Dividendes, etc.).
--
-- Tables: GTR.DOPE, GTR.NATU
-- Compte figé: 1812-201
--
-- Données d'entrée :
--   :date_debut  — date de début (borne inclusive, format DD/MM/YYYY)
--   :date_fin    — date de fin (borne inclusive, format DD/MM/YYYY)

SELECT d.c_pca,
       d.n_op,
       d.d_cpta,
       d.n_lig_op,
       d.c_typ_det,
       d.c_it,
       d.c_ope,
       d.m_oper                                AS montant,
       d.c_ref1,
       d.c_ref2,
       d.c_rf,
       d.d_deb_val,
       d.c_enc,
       d.c_rcod,
       d.c_typnat,
       d.c_nat                                 AS code,
       NVL(n.l_nat, 'Transferts')              AS type_recette,
       n.l_nat                                 AS libelle_nature
FROM   GTR.DOPE d
LEFT JOIN GTR.NATU n
       ON n.c_typnat = d.c_typnat
      AND n.c_nat    = d.c_nat
WHERE  d.c_typ_det IN ('X', 'S')
AND    d.c_it = '1812-201'
AND    d.d_cpta >= TO_DATE(:date_debut, 'DD/MM/YYYY')
AND    d.d_cpta <  TO_DATE(:date_fin, 'DD/MM/YYYY') + 1
AND    (d.c_nat IS NULL OR UPPER(TRIM(d.c_nat)) <> 'N/A')
AND    (n.l_nat IS NULL OR UPPER(TRIM(n.l_nat)) <> 'N/A')
AND    (d.c_ref1 IS NULL OR UPPER(TRIM(d.c_ref1)) <> 'N/A')
AND    (d.c_ref2 IS NULL OR UPPER(TRIM(d.c_ref2)) <> 'N/A')
ORDER  BY d.d_cpta, d.n_op, d.n_lig_op;

-- Connexion: Oracle (lecture seule) — Service des Opérations Financières
--
-- Recettes pétrolières — OP BEAC : agrégation par type de recette (IG).
-- Vue: STAT.VM_REC_BEAC
--
-- Données d'entrée :
--   :date_debut  — date de début (borne inclusive, format DD/MM/YYYY)
--   :date_fin    — date de fin (borne inclusive, format DD/MM/YYYY)

SELECT c_rec                       AS code,
       l_rec                       AS type_recette,
       SUM(montant)                AS montant
FROM   STAT.VM_REC_BEAC
WHERE  d_oper >= TO_DATE(:date_debut, 'DD/MM/YYYY')
AND    d_oper <  TO_DATE(:date_fin, 'DD/MM/YYYY') + 1
GROUP  BY c_rec, l_rec
ORDER  BY c_rec;

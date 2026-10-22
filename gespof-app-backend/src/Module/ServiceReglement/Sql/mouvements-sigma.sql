-- Connexion: sgp (Oracle, lecture seule) — Service des Règlements
--
-- 4) Mouvements SIGMA (virements BEAC) du jour.
-- Table: OP_BEAC
-- Paramètre: :d_presentation (chaîne DD/MM/YYYY) — un seul jour
-- C_TYP = 'D' : débits (dépenses) uniquement. Chaque ligne est déjà une opération
-- individuelle — pas d'agrégation PHP (voir FicheDepotService::construireMouvementsSigma).

SELECT
    ORIG        AS "ORIG",
    N_DOC       AS "N_DOC",
    D_OPER      AS "D_PRESENTATION",
    C_TYP       AS "C_TYP",
    M_OPER      AS "MONTANT_SIGMA",
    C_REF       AS "N_OV",
    L_TIERS     AS "BENEFICIAIRE",
    L_OBJ       AS "OBJET",
    L_COM       AS "L_COM",
    L_EXP       AS "L_EXP",
    L_DEST      AS "BANQUE",
    C_FISC      AS "C_FISC",
    C_QUIT      AS "C_QUIT"
FROM OP_BEAC
WHERE ORIG = 'GM'
  AND C_TYP = 'D'
  AND D_OPER = TO_DATE(:d_presentation, 'DD/MM/YYYY')

-- Connexion: sgp (Oracle, lecture seule)

-- Etapes du processus de génération de la fiche de dépôt:


-- 1) Requettes pour recuperer la fiche de dépôt.
-- Vue: v_recap_dsgp
-- Paramètre d'entrée: d_presentation (string 'DD/MM/YYYY') — filtre sur un seul jour

SELECT
    C_ORIG              AS "C_ORIG",
    D_PRESENTATION      AS "D_PRESENTATION",
    L_ORIG              AS "L_ORIG",
    N_BV                AS "N_BV",
    NB_REGL             AS "NB_REGL",
    MONTANT_SYSTAC      AS "MONTANT_SYSTAC",
    NB_REGL_SYGMA       AS "NB_REGL_SYGMA",
    MONTANT_SYGMA       AS "MONTANT_SYGMA",
    D_CREATION_IP       AS "D_CREATION_IP",
    D_ARRET_IP          AS "D_GENERATION"
FROM v_recap_dsgp
WHERE d_valeur IS NOT NULL
  AND d_presentation >= TO_DATE(:d_presentation, 'DD/MM/YYYY')
  AND d_presentation <= TO_DATE(:d_presentation, 'DD/MM/YYYY')
  AND montant_systac > 0
  AND d_creation_ip IS NOT NULL
  AND d_arret_ip IS NOT NULL
ORDER BY n_ordre, n_bv


-- 2) Récupération des règlements d'un BV
-- Table: dmc.regt (NB : il existe aussi un "regt" dans les schémas gtr/djadja,
-- homonymes mais vides pour nos données — toujours préfixer par "dmc.")
-- Paramètre d'entrée: {{n_bv_list}} — liste de N_BV de taille variable (le N_BV de chaque
-- Oracle/oci8 ne supporte pas le bind d'un tableau sur un seul paramètre nommé pour un IN :
-- le code appelant doit générer un placeholder par élément (:n_bv_0, :n_bv_1, ..., :n_bv_N-1)
--    (m_regl - m_prec_tva)          AS "Net_a_Payer" -- (montant brut du règlement) - (précompte/TVA retenue à la source)
SELECT
    n_bv            AS "N_BV",
    n_emis          AS "Numero_emission",
    n_regl          AS "N_Regl",
    (m_regl - m_prec_tva)          AS "Net_a_Payer" -- (montant brut du règlement) - (précompte/TVA retenue à la source)
FROM dmc.regt
WHERE n_bv IN ({{n_bv_list}})
ORDER BY n_bv, n_emis


-- 2 bis) Regroupement des règlements de l'étape 2 par N_BV (post-traitement PHP,
-- pas une requête SQL — voir ScriptPoolDr::groupReglementsByBv()).
-- Équivalent :
--   resultat = {}
--   data.forEach(item => {
--     const nBV = item.N_BV;
--     if (!resultat[nBV]) resultat[nBV] = [];
--     resultat[nBV].push({ Numero_emission: item.Numero_emission, N_Regl: item.N_Regl, Net_a_Payer: item.Net_a_Payer });
--   });


-- 3) Récupération de l'intitulé (L_INTCPT) d'une liste de règlements
-- Table: dmc.regt
-- Paramètre d'entrée: liste de paires (n_emis, n_regl) de taille variable
-- (typiquement les (Numero_emission, N_Regl) obtenus à l'étape 2).
--
-- IMPORTANT : ne PAS écrire ceci en "(n_emis, n_regl) IN ((a,b),(c,d),...)" ni en
-- OR chaînés "(n_emis=a AND n_regl=b) OR (n_emis=c AND n_regl=d) OR ..." — mesuré
-- en pratique sur dmc.regt : les DEUX formes font ignorer l'index par l'optimiseur
-- Oracle (full scan, 30s+ de timeout dès 2 paires), alors qu'une égalité simple
-- (n_emis = x AND n_regl = y) est instantanée. La solution qui marche : un
-- UNION ALL d'une requête par paire (voir ScriptPoolDr::findIntitulesByEmisReglPairs) :
--
--   SELECT n_emis AS "Numero_emission", n_regl AS "N_Regl", l_intcpt AS "Intitule"
--   FROM dmc.regt WHERE n_emis = :n_emis_0 AND n_regl = :n_regl_0
--   UNION ALL
--   SELECT n_emis AS "Numero_emission", n_regl AS "N_Regl", l_intcpt AS "Intitule"
--   FROM dmc.regt WHERE n_emis = :n_emis_1 AND n_regl = :n_regl_1
--   UNION ALL
--   ... (un bloc par paire)

SELECT n_emis AS "Numero_emission", n_regl AS "N_Regl", l_intcpt AS "Intitule"
FROM dmc.regt
WHERE n_emis = :n_emis_0 AND n_regl = :n_regl_0




-- 4) Récupération des mouvements SIGMA (virements BEAC) d'un jour
-- Table: OP_BEAC
-- Paramètre d'entrée: d_presentation (string 'DD/MM/YYYY') — filtre sur un seul jour
-- Contrairement aux étapes 1-3 (SYSTAC), chaque ligne renvoyée est déjà une opération
-- individuelle : aucune agrégation/réconciliation n'est nécessaire côté PHP, elle est
-- transformée directement en une paire LigneSygma (brute) / MouvementSygma (dérivé) — voir
-- ScriptPoolDr::findSigmaByDate() et FicheDepotService::construireMouvementsSigma().
-- C_TYP = 'D' : on ne garde que les débits (dépenses), pas les crédits.

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

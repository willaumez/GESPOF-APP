import type { ConfigImportDepot } from "@/portails/Sof/components/SofImportDepotPage";

const VIDR =
  "C_PCA, D_CPTA, N_REGL, N_LIG_R, C_TYP_OP, N_OP, C_GUIC, N_MATTIR, L_NP, C_OPE, C_IT, C_NAT, C_REF1, C_REF2, M_REGL, C_NOP, C_MDR, N_CHEQ, C_CAIS";

export const DEPOT_ORDONNANCES_VISEES: ConfigImportDepot = {
  titre: "Ordonnances visées",
  description:
    "Source DC. L'import validé remplace le lot précédent de la même source et de la même période.",
  remplace: "XLOP → ORDOS.xlsx",
  origine: "DC",
  requeteOracle: "XLOP",
  sqlStub: "dc-ordonnances-visees-xlop.sql",
  filtres: [
    ["Exercice d'imputation", "2026"],
    ["Origine", "Ordonnances visées"],
    ["Période du", "01/01/2026"],
    ["Au", "30/11/2025"],
  ],
  colonnes:
    "ECHÉANCE, EX, ORDONNANCE, N_LIG, D_EMIS, MIN, MIS, PROG, ACT, TIT, BOP, UO, PC, NAT, MDR, MATRIC, NOM, M_BRUT".split(
      ", ",
    ),
  controles: [
    "Alerte si le nombre de lignes chute fortement par rapport à l'import précédent.",
  ],
};

export const DEPOT_RAP_BOP: ConfigImportDepot = {
  titre: "RAP mode BOP",
  description:
    "Source DC. L'import validé remplace le lot précédent de la même source et de la même période.",
  remplace: "XRAV → RAP mode BOP.xlsx",
  origine: "DC",
  requeteOracle: "XRAV",
  sqlStub: "dc-rap-mode-bop-xrav.sql",
  filtres: [
    ["Émission du", "01/01/2014"],
    ["Au (date de situation)", "30/11/2025"],
  ],
  colonnes:
    "ORDONNANCE, D_EMIS, ECHÉANCE, EX, C_CATEG, TIT, NAT, MDR, M_BRUT, RAP".split(
      ", ",
    ),
  controles: ["Catégorie hors TPG, AGC, ENT signalée."],
};

export const DEPOT_RAP_AVANT_BOP: ConfigImportDepot = {
  titre: "RAP avant BOP",
  description:
    "Fichier fixe fourni (pas d'écran Oracle dans les manuels). L'import validé remplace le lot précédent.",
  remplace: "RAP avant BOP.xlsx",
  origine: "DC · fichier fixe",
  requeteOracle: null,
  sqlStub: "dc-rap-avant-bop.sql",
  filtres: [["Source", "Fichier fixe"]],
  colonnes:
    "ORDONNANCE, D_EMIS, ECHÉANCE, EX, C_CATEG, TIT, NAT, MDR, M_BRUT, RAP, MINISTERE, NATURE".split(
      ", ",
    ),
  controles: ["Format différent du BOP signalé."],
  note: "Format à définir — dépôt Excel uniquement jusqu'à confirmation d'un écran Oracle.",
};

export const DEPOT_CDEL_DC: ConfigImportDepot = {
  titre: "Situation des crédits délégués",
  description:
    "Source DC. L'import validé remplace le lot précédent de la même source et de la même période.",
  remplace: "CDEL → CDEL.xlsx",
  origine: "DC",
  requeteOracle: "CDEL",
  sqlStub: "dc-situation-credits-delegues-cdel.sql",
  filtres: [
    ["Exercice", "2026"],
    ["Postes", "Tous les postes"],
  ],
  colonnes:
    "PC, N° AD, MINISTÈRE, MISSION, PROGRAMME, ACTION, TITRE, BOP, UO, MONTANT, RESTE À PAYER".split(
      ", ",
    ),
  controles: ["Reste à payer négatif signalé."],
};

export const DEPOT_FISCALES_IG: ConfigImportDepot = {
  titre: "Recettes fiscales (1812 / 4781 / 4783)",
  description:
    "Source IG. L'import validé remplace le lot précédent de la même source et de la même période.",
  remplace: "VIDR → recettes fiscales",
  origine: "IG",
  requeteOracle: "VIDR",
  sqlStub: "recettes-fiscales-1812-4781-4783-vidr.sql",
  filtres: [
    ["Comptes", "1812, 4781, 4783"],
    ["Période du", "01/01/2026"],
    ["Au", "30/11/2025"],
  ],
  colonnes: VIDR.split(", "),
  controles: ["Prises en charge sans nature signalées.", "Colonnes VIDR."],
};

export const DEPOT_DEVERSEMENTS: ConfigImportDepot = {
  titre: "Déversements solde et pension",
  description:
    "Source IG (RCDD). Contrôle des états liquidatifs. L'import validé remplace le lot précédent.",
  remplace: "RCDD → déversements",
  origine: "IG",
  requeteOracle: "RCDD",
  sqlStub: "depenses-etats-liquidation.sql",
  filtres: [
    ["Code", "SOLDE ETAT, PENSIONS"],
    ["État", "Validé"],
  ],
  colonnes:
    "DÉVERSEMENT, DATE, DATE DE VALEUR, NB_REGL, M_BRUT, M_NET, DATE DE VALIDATION".split(
      ", ",
    ),
  controles: ["Colonnes RCDD.", "Probable équivalent de depenses-etats-liquidation.sql — à confirmer."],
};

export const DEPOT_MVM_FE: ConfigImportDepot = {
  titre: "Mouvements de fonds et effets",
  description:
    "Trois extractions IG (comptes 181*, 581* à 584*). L'import validé remplace le lot précédent.",
  remplace: "VIDR → MVM_FE",
  origine: "IG",
  requeteOracle: "VIDR",
  sqlStub: "mouvements-fonds-effets-vidr.sql",
  filtres: [
    ["Comptes", "181*, 581–584*"],
    ["Période du", "01/01/2026"],
    ["Au", "30/11/2025"],
  ],
  colonnes: "REGROUPEMENT, DÉBITS NETS, LIBELLÉ".split(", "),
  controles: [
    "Regroupements attendus : 181, 582, 583, 584.",
    "Comptes exacts à confirmer avec le Chef SOF.",
  ],
};

export const DEPOT_DETTE: ConfigImportDepot = {
  titre: "Exécution de la dette (TDP)",
  description:
    "Fichier TDP (format F12). L'import validé remplace le lot précédent.",
  remplace: "« Dette Brute »",
  origine: "Service · TDP",
  filtres: [["Source", "Trésorerie de la Dette Publique"]],
  colonnes: "CRÉANCIER, TYPE, NATURE, M01 … M12".split(", "),
  controles: ["Principal et intérêts, intérieure et extérieure."],
};

export const DEPOT_TITRES: ConfigImportDepot = {
  titre: "Émissions BTA / OTA (SMC)",
  description:
    "Fichier SMC (format F12). L'import validé remplace le lot précédent.",
  remplace: "« Récap BTA OTA »",
  origine: "Service · SMC",
  filtres: [["Source", "Service Monnaie et Crédit"]],
  colonnes: "TITRE, LIGNE, M01 … M12".split(", "),
  controles: [
    "Lignes : émissions, remboursements, intérêts précomptés, intérêts courus.",
  ],
};

export const DEPOT_FACILITES: ConfigImportDepot = {
  titre: "Facilités et agios (SCR)",
  description:
    "Fichier SCR (format F12). L'import validé remplace le lot précédent.",
  remplace: "Principal facilités / Agios",
  origine: "Service · SCR",
  filtres: [["Source", "Service Contrôle des Risques"]],
  colonnes: "FACILITÉ, SENS, M01 … M12 ; COMPTE, AGIOS, M01 … M12".split(", "),
  controles: ["Deux grilles × mois."],
};

export const DEPOT_COVID: ConfigImportDepot = {
  titre: "Fonds COVID-19",
  description:
    "Fichiers Riposte et Solidarité (format F12). L'import validé remplace le lot précédent.",
  remplace: "« Riposte », « Solidarité »",
  origine: "Service · Agent comptable des fonds",
  filtres: [["Source", "Agent comptable des fonds"]],
  colonnes: "FONDS, RUBRIQUE, M01 … M12".split(", "),
  controles: ["Une grille par fonds."],
};

export const DEPOT_LIQUIDATIFS: ConfigImportDepot = {
  titre: "États liquidatifs (solde, MONP, pension)",
  description:
    "Fichiers Direction de la Dépense / CPPF (format F12). L'import validé remplace le lot précédent.",
  remplace: "États liquidatifs",
  origine: "Service · Direction de la Dépense, CPPF",
  filtres: [["Source", "Direction de la Dépense / CPPF"]],
  colonnes: "SOLDE PERMANENTE, MONP, PENSION (BRUT, NET)".split(", "),
  controles: ["Écart avec les déversements IG."],
  note: "Format non confirmé : états non reçus.",
};

export const DEPOT_FICHES_COMPTES: ConfigImportDepot = {
  titre: "Fiches de comptes (CAS Pensions, CNAMGS)",
  description:
    "Fiches Qualité Comptable (format F12). L'import validé remplace le lot précédent.",
  remplace: "Fiches de comptes",
  origine: "Service · Qualité Comptable",
  filtres: [["Comptes", "7251-1, 7251-2, 7251-3, 4663-317"]],
  colonnes: "7251-1, 7251-2, 7251-3, 4663-317".split(", "),
  controles: ["Formulaire de 4 lignes."],
  note: "Format non confirmé : fiches non reçues.",
};

export const DEPOT_BALANCE: ConfigImportDepot = {
  titre: "Balance générale mensuelle",
  description:
    "Balance comptable du mois (format F13). L'import validé remplace le lot précédent.",
  remplace: "Balance générale",
  origine: "Comptabilité",
  requeteOracle: "À identifier",
  sqlStub: "comptabilite-balance-generale.sql",
  filtres: [
    ["Exercice", "2026"],
    ["Mois", "Novembre"],
  ],
  colonnes:
    "COMPTE, LIBELLÉ, SOLDE ENTRÉE, SENS, DÉBITS ANT., CRÉDITS ANT., DÉBITS MOIS, CRÉDITS MOIS, DÉBITS ARRÊTÉS, CRÉDITS ARRÊTÉS, NOUVEAU SOLDE".split(
      ", ",
    ),
  controles: ["Total débits = total crédits."],
  note: "Cheminement écran absent des manuels.",
};

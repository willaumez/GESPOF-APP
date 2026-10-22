export interface TeinteCompteDouane {
  bande: string;
  fond: string;
  texte: string;
}

/** Teintes du référentiel « Comptes douane » — une couleur par type. */
export const TEINTE_TYPE_COMPTE_DOUANE: Record<string, TeinteCompteDouane> = {
  DOUANE_A_CREDIT: { bande: "#2a7f62", fond: "#e8f5ef", texte: "#14533f" },
  DOUANE_AU_COMPTANT: { bande: "#1e6650", fond: "#e4f1eb", texte: "#134436" },
  DOUANE_MANUELLE: { bande: "#3d6b8a", fond: "#e8f0f6", texte: "#1e3d52" },
  RUSID: { bande: "#8a5a2a", fond: "#f6eee6", texte: "#5c3a18" },
  COMPTE_DE_TRANSFERT: { bande: "#3f5f7a", fond: "#e8eef3", texte: "#24384a" },
};

export const ORDRE_TYPES_COMPTE_DOUANE = [
  "DOUANE_A_CREDIT",
  "DOUANE_AU_COMPTANT",
  "DOUANE_MANUELLE",
  "RUSID",
  "COMPTE_DE_TRANSFERT",
] as const;

export function teinteCompteDouane(type: string): TeinteCompteDouane {
  return TEINTE_TYPE_COMPTE_DOUANE[type] ?? TEINTE_TYPE_COMPTE_DOUANE.DOUANE_A_CREDIT;
}

import type { LigneMouvement } from "@/portails/Dr/modules/ServiceReglement/types";
import type { LigneFiltrable } from "./constants";

export function correspondFiltre(ligne: LigneFiltrable, filtre: string): boolean {
  if (!filtre) return true;
  const champs = [ligne.beneficiaire, ligne.banque, ligne.numero_ov];
  return champs.some((champ) =>
    (champ ?? "").toString().toLowerCase().includes(filtre),
  );
}

export function parseMontant(value: string | null | undefined): number {
  const n = value ? parseFloat(value) : NaN;
  return Number.isNaN(n) ? 0 : n;
}

export interface LigneRegroupee {
  ligne: LigneMouvement;
  premierDuGroupe: boolean;
  dernierDuGroupe: boolean;
  tailleGroupe: number;
}

export function regrouperParObservations(lignes: LigneMouvement[]): LigneRegroupee[] {
  const clef = (l: LigneMouvement) =>
    l.observations.length > 0
      ? l.observations
          .map((o) => o.id)
          .sort((a, b) => a - b)
          .join(",")
      : `__solo-${l.id}`;

  const ordreGroupes: string[] = [];
  const groupes = new Map<string, LigneMouvement[]>();
  for (const l of lignes) {
    const k = clef(l);
    if (!groupes.has(k)) {
      groupes.set(k, []);
      ordreGroupes.push(k);
    }
    groupes.get(k)!.push(l);
  }

  return ordreGroupes.flatMap((k) => {
    const groupe = groupes.get(k)!;
    return groupe.map((ligne, i) => ({
      ligne,
      premierDuGroupe: i === 0,
      dernierDuGroupe: i === groupe.length - 1,
      tailleGroupe: groupe.length,
    }));
  });
}

export function versEntreeDate(valeur: string | null | undefined): string {
  if (!valeur) return "";
  const [jourMoisAnnee] = valeur.split(" ");
  const [j, m, a] = (jourMoisAnnee ?? "").split("/");
  return j && m && a ? `${a}-${m}-${j}` : "";
}

import type { LigneGrilleMensuelle } from "@/portails/Sof/components/SofGrilleMensuellePage";
import type { GrilleLigneSof, GrilleSof } from "@/portails/Sof/types/parametrage.interface";

export function moisVersNombres(mois: string[] | number[] | undefined): number[] {
  const out = Array.from({ length: 12 }, () => 0);
  if (!mois) return out;
  for (let i = 0; i < 12; i++) {
    const v = mois[i];
    out[i] = typeof v === "number" ? v : Number(v) || 0;
  }
  return out;
}

export function grilleApiVersLignes(grille: GrilleSof): LigneGrilleMensuelle[] {
  return grille.lignes.map((l, i) => ({
    id: l.code || String(l.id ?? i),
    code: l.code ?? undefined,
    libelle: l.libelle,
    niveau: l.niveau,
    calculable: l.calculable,
    mois: moisVersNombres(l.mois),
  }));
}

export function lignesVersApi(
  lignes: LigneGrilleMensuelle[],
): GrilleLigneSof[] {
  return lignes.map((l, i) => ({
    code: l.code ?? l.id,
    libelle: l.libelle,
    ordre: i,
    rubrique_code: l.code ?? null,
    niveau: l.niveau ?? 0,
    calculable: Boolean(l.calculable),
    mois: l.mois.map((m) => String(m || 0)),
  }));
}

export function modeleVersLignes(
  modele: Array<{
    id: string;
    libelle: string;
    code?: string;
    niveau?: number;
    calculable?: boolean;
  }>,
): LigneGrilleMensuelle[] {
  return modele.map((l) => ({
    ...l,
    mois: Array.from({ length: 12 }, () => 0),
  }));
}

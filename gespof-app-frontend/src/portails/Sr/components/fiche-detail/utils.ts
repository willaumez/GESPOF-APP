import type { CSSProperties } from "react";
import { getPortalMenu } from "@/shared/config/menu";
import type { LigneMouvement, ObservationLigne } from "@/portails/Sr/types";

/** Fond + liseré gauche aux couleurs du portail SR pour les lignes modifiées manuellement. */
export function styleLigneManuelle(): CSSProperties {
  const { topColor, bgColor } = getPortalMenu("sr").theme;
  return {
    background: bgColor,
    boxShadow: `inset 3px 0 0 ${topColor}`,
  };
}
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

/** Affiche une date API en jj/mm/aaaa (sans heure). Accepte Y-m-d, d/m/Y, ISO. */
export function formaterDateSansHeure(valeur: string | null | undefined): string {
  if (!valeur) return "—";
  const brut = valeur.trim().split(/[\sT]/)[0] ?? "";
  if (!brut) return "—";

  // Déjà jj/mm/aaaa
  const fr = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(brut);
  if (fr) return `${fr[1]}/${fr[2]}/${fr[3]}`;

  // ISO aaaa-mm-jj
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(brut);
  if (iso) return `${iso[3]}/${iso[2]}/${iso[1]}`;

  // jj-mm-aaaa
  const tiret = /^(\d{2})-(\d{2})-(\d{4})$/.exec(brut);
  if (tiret) return `${tiret[1]}/${tiret[2]}/${tiret[3]}`;

  return brut;
}

/** Affiche date + heure en jj/mm/aaaa HH:mm (secondes omises). */
export function formaterDateHeureFr(valeur: string | null | undefined): string {
  if (!valeur) return "—";
  const trim = valeur.trim();
  const [datePart, timePart] = trim.split(/[\sT]/);
  const dateFr = formaterDateSansHeure(datePart);
  if (!timePart) return dateFr;
  const hhmm = timePart.slice(0, 5);
  return hhmm ? `${dateFr} ${hhmm}` : dateFr;
}

/** Normalise le champ observations (tableau, objet JSON PHP, ou absent). */
export function observationsDe(
  ligne: { observations?: ObservationLigne[] | Record<string, ObservationLigne> | null } | null | undefined,
): ObservationLigne[] {
  const brut = ligne?.observations;
  if (Array.isArray(brut)) return brut.filter(Boolean);
  if (brut && typeof brut === "object") return Object.values(brut).filter(Boolean);
  return [];
}

export function libelleObservations(ligne: { observations?: ObservationLigne[] | Record<string, ObservationLigne> | null } | null | undefined): string {
  const textes = observationsDe(ligne).map((o) => o.contenu).filter(Boolean);
  return textes.length > 0 ? textes.join(" · ") : "";
}

export interface LigneRegroupee {
  ligne: LigneMouvement;
  premierDuGroupe: boolean;
  dernierDuGroupe: boolean;
  tailleGroupe: number;
  sommeDepenses: number;
}

export function regrouperParObservations(lignes: LigneMouvement[]): LigneRegroupee[] {
  const clef = (l: LigneMouvement) => {
    const obs = observationsDe(l);
    return obs.length > 0
      ? obs
          .map((o) => o.id)
          .sort((a, b) => a - b)
          .join(",")
      : `__solo-${l.id}`;
  };

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
    const sommeDepenses = groupe.reduce((s, l) => s + (Number(l.depenses) || 0), 0);
    return groupe.map((ligne, i) => ({
      ligne,
      premierDuGroupe: i === 0,
      dernierDuGroupe: i === groupe.length - 1,
      tailleGroupe: groupe.length,
      sommeDepenses,
    }));
  });
}

export function versEntreeDate(valeur: string | null | undefined): string {
  if (!valeur) return "";
  const [jourMoisAnnee] = valeur.split(" ");
  const [j, m, a] = (jourMoisAnnee ?? "").split("/");
  return j && m && a ? `${a}-${m}-${j}` : "";
}

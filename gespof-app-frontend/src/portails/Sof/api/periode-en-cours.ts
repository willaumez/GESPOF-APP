import { requeteApi } from "@/shared/lib/api";
import { SERVICE_OPERATIONS_ENDPOINTS } from "./endpoints";
import type {
  ExerciceSof,
  PeriodeSof,
} from "@/portails/Sof/types/referentiel.interface";

export type StatutImportSource =
  | "recu"
  | "manquant"
  | "annule"
  | "remplace"
  | "a_valider";

export type StatutEtapeCycle = "termine" | "en_cours" | "a_faire";

export interface ImportSourceSof {
  cle?: string;
  format: string;
  source: string;
  origine: string;
  href?: string;
  statut: StatutImportSource;
  statut_libelle: string;
  dernier_import: string | null;
  nb_lignes: number | null;
  lot_id: number | null;
  lot_reference: string | null;
}

export interface KpiPeriodeEnCours {
  code: string;
  label: string;
  valeur: string;
  unite: string | null;
  sous: string;
  accent: string;
  fg: string;
  montant?: boolean;
}

export interface EtapeCycleSof {
  n: number;
  code: string;
  libelle: string;
  href: string;
  statut: StatutEtapeCycle;
  statut_libelle: string;
}

export interface EcartAccueilSof {
  code: string;
  label: string;
  montant: string;
  href: string;
  justifie: boolean;
  sous: string;
  accent: string;
  fg: string;
}

export interface PointAttentionSof {
  code: string;
  libelle: string;
  sous_titre: string;
  coche: boolean;
  lecture_seule: boolean;
}

export interface SyntheseItemSof {
  code: string;
  label: string;
  montant: string | null;
  sous: string;
  accent: string;
  fg: string;
}

export interface SyntheseAccueilSof {
  disponible: boolean;
  message: string | null;
  items: SyntheseItemSof[];
}

export interface PeriodeEnCoursSof {
  exercice: ExerciceSof | null;
  periode: PeriodeSof | null;
  periode_libelle: string;
  description: string;
  kpis: KpiPeriodeEnCours[];
  etapes: EtapeCycleSof[];
  etape_en_cours_href: string;
  peut_ouvrir_suivante: boolean;
  imports: ImportSourceSof[];
  imports_recus: number;
  imports_total: number;
  imports_sous_titre: string;
  ecarts: EcartAccueilSof[];
  points_attention: PointAttentionSof[];
  points_coches: number;
  points_total: number;
  points_pied: string;
  synthese: SyntheseAccueilSof;
  dernier_rd_valide?: { libelle: string; sous: string } | null;
}

export function obtenirPeriodeEnCours(
  periodeId?: number,
): Promise<PeriodeEnCoursSof> {
  const q =
    periodeId != null
      ? `?periode_id=${encodeURIComponent(String(periodeId))}`
      : "";
  return requeteApi(`${SERVICE_OPERATIONS_ENDPOINTS.PERIODE_EN_COURS}${q}`);
}

export function basculerPointAttention(donnees: {
  periode_id: number;
  code: string;
  coche: boolean;
}): Promise<PeriodeEnCoursSof> {
  return requeteApi(
    `${SERVICE_OPERATIONS_ENDPOINTS.PERIODE_EN_COURS}/points-attention`,
    {
      method: "PUT",
      body: JSON.stringify(donnees),
    },
  );
}

export function ouvrirPeriodeSuivante(periodeId: number): Promise<{
  periode: PeriodeSof;
  synthese: PeriodeEnCoursSof;
}> {
  return requeteApi(
    `${SERVICE_OPERATIONS_ENDPOINTS.PERIODE_EN_COURS}/periode-suivante`,
    {
      method: "POST",
      body: JSON.stringify({ periode_id: periodeId }),
    },
  );
}

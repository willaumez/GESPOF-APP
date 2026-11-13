import { requeteApi } from "@/shared/lib/api";
import { SERVICE_OPERATIONS_ENDPOINTS } from "./endpoints";

const BASE = SERVICE_OPERATIONS_ENDPOINTS.EXTRACTIONS;

export type FamilleExtraction = { id: string; libelle: string };

export type PresetDefinition = {
  code: string;
  libelle: string;
  source: "IG" | "DC";
  famille: string;
  domaine: string;
  domaine_libelle: string;
  ecran: string;
  format: string;
  sql_file: string | null;
  periode_par_defaut: string;
  disponible: boolean;
  depot_excel_uniquement: boolean;
  motif_indisponible: string;
  ref_manuel: string | null;
  source_lot: string;
};

export type StatutPreset = {
  code: string;
  statut: "a_extraire" | "a_jour" | "indisponible" | "excel" | string;
  periode_calculee: { debut: string | null; fin: string | null };
  dernier_lot: {
    id: number;
    importe_le: string;
    nb_lignes: number;
    montant_total: string;
    statut: string;
  } | null;
};

export type ElementLancement = {
  id: number;
  parent_id: number | null;
  ordre: number;
  code_preset: string | null;
  compte: string | null;
  nature: string | null;
  titre: string;
  statut: string;
  lignes_traitees: number | null;
  lignes_a_extraire: number | null;
  pourcentage: number;
  message: string | null;
  lot_id: number | null;
};

export type LancementExtraction = {
  id: number;
  periode_id: number;
  exercice: number;
  date_situation: string;
  statut: string;
  pourcentage: number;
  debut: string;
  fin: string | null;
  temps_ecoule_s: number;
  elements: ElementLancement[];
};

export type DefinitionsResponse = {
  familles: FamilleExtraction[];
  presets: PresetDefinition[];
};

export type StatutsResponse = {
  periode_id: number | null;
  exercice: number;
  date_situation: string;
  presets: StatutPreset[];
  lancement_en_cours_id: number | null;
};

export function obtenirDefinitionsExtractions() {
  return requeteApi<DefinitionsResponse>(`${BASE}/definitions`);
}

export type SurchargePreset = {
  date_debut?: string;
  date_fin?: string;
};

export function obtenirStatutsExtractions(
  periodeId?: number | null,
  dateSituation?: string | null,
) {
  const params = new URLSearchParams();
  if (periodeId != null && periodeId > 0) {
    params.set("periode_id", String(periodeId));
  }
  if (dateSituation) {
    params.set("date_situation", dateSituation);
  }
  const q = params.toString() ? `?${params.toString()}` : "";
  return requeteApi<StatutsResponse>(`${BASE}/statuts${q}`);
}

export function executerExtractions(payload: {
  periodeId: number;
  codes: string[];
  date_situation?: string;
  surcharges?: Record<string, SurchargePreset>;
}) {
  return requeteApi<LancementExtraction>(`${BASE}/executer`, {
    method: "POST",
    body: JSON.stringify(payload),
    timeoutMs: 60_000,
  });
}

export function obtenirLancement(id: number) {
  return requeteApi<LancementExtraction>(`${BASE}/lancements/${id}`);
}

export function avancerLancement(id: number) {
  return requeteApi<LancementExtraction>(`${BASE}/lancements/${id}/avancer`, {
    method: "POST",
    timeoutMs: 300_000,
  });
}

export function annulerLancement(id: number) {
  return requeteApi<LancementExtraction>(`${BASE}/lancements/${id}/annuler`, {
    method: "POST",
  });
}

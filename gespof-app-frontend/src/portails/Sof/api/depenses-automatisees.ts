import { requeteApi } from "@/shared/lib/api";
import { SERVICE_OPERATIONS_ENDPOINTS } from "./endpoints";
import type { PeriodeSof } from "@/portails/Sof/types/referentiel.interface";

export type DepenseAutomatiseeSlug =
  | "ordonnances"
  | "credits-delegues"
  | "avances"
  | "correspondants";

export type VueDepensesAutomatisees = "agregee" | "detail";
export type AffichageDepensesAutomatisees = "mois" | "cumul";
export type FiltreLignesDepenses = "toutes" | "non-flechees";

export interface CodeDepenseAutomatisee {
  code: string;
  libelle: string;
  mois: string[];
  total: string;
}

export interface DepensesAutomatiseesAgregeesPage {
  page: DepenseAutomatiseeSlug;
  titre: string;
  description: string;
  periode: PeriodeSof | null;
  vue: "agregee";
  affichage: AffichageDepensesAutomatisees;
  codes: CodeDepenseAutomatisee[];
  totaux: {
    mois: string[];
    total: string;
  };
  message: string | null;
}

export interface LigneDetailDepenseAutomatisee {
  source_id: string;
  mois: number;
  mois_libelle: string | null;
  montant: string;
  code: string;
  code_libelle: string;
  categorie?: string | null;
  type?: string | null;
  titre?: string | null;
  nature?: string | null;
  mode_reglement?: string | null;
  beneficiaire?: string | null;
  objet?: string | null;
  ordonnance?: string | null;
  numero_reglement?: string | null;
  exercice?: string | null;
  type_exercice?: string | null;
  anomalie?: string | null;
  mode?: string | null;
  libelle?: string | null;
  compte?: string | null;
  titre_budgetaire?: string | null;
}

export interface DepensesAutomatiseesDetailPage {
  page: DepenseAutomatiseeSlug;
  titre: string;
  description: string;
  periode: PeriodeSof | null;
  vue: "detail";
  affichage: AffichageDepensesAutomatisees;
  lignes: LigneDetailDepenseAutomatisee[];
  nombre_none: number;
  message: string | null;
}

export type ReponseDepensesAutomatisees =
  | DepensesAutomatiseesAgregeesPage
  | DepensesAutomatiseesDetailPage;

export function obtenirDepensesAutomatisees(params: {
  page: DepenseAutomatiseeSlug;
  periode_id?: number;
  vue?: VueDepensesAutomatisees;
  affichage?: AffichageDepensesAutomatisees;
  lignes?: FiltreLignesDepenses;
  search?: string;
  code?: string;
  titre?: string;
}): Promise<ReponseDepensesAutomatisees> {
  const q = new URLSearchParams();
  if (params.periode_id != null) q.set("periode_id", String(params.periode_id));
  if (params.vue) q.set("vue", params.vue);
  if (params.affichage) q.set("affichage", params.affichage);
  if (params.lignes) q.set("lignes", params.lignes);
  if (params.search) q.set("search", params.search);
  if (params.code) q.set("code", params.code);
  if (params.titre) q.set("titre", params.titre);

  const qs = q.toString();
  return requeteApi(
    `${SERVICE_OPERATIONS_ENDPOINTS.DEPENSES_AUTOMATISEES}/${params.page}${qs ? `?${qs}` : ""}`,
  );
}

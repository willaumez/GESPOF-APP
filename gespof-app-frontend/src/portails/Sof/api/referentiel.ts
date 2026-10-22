import { requeteApi } from "@/shared/lib/api";
import { SERVICE_OPERATIONS_ENDPOINTS } from "./endpoints";
import type {
  ExerciceSof,
  RubriqueDepenseNoeud,
  RubriqueRecetteNoeud,
} from "@/portails/Sof/types/referentiel.interface";

export function listerRubriquesRecettes(): Promise<{ rubriques: RubriqueRecetteNoeud[] }> {
  return requeteApi(SERVICE_OPERATIONS_ENDPOINTS.RUBRIQUES_RECETTES);
}

export function listerRubriquesDepenses(): Promise<{ rubriques: RubriqueDepenseNoeud[] }> {
  return requeteApi(SERVICE_OPERATIONS_ENDPOINTS.RUBRIQUES_DEPENSES);
}

export function listerExercices(): Promise<{ exercices: ExerciceSof[] }> {
  return requeteApi(SERVICE_OPERATIONS_ENDPOINTS.EXERCICES);
}

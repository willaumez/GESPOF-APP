import { requeteApi } from "@/shared/lib/api";
import { SERVICE_OPERATIONS_ENDPOINTS } from "./endpoints";
import type {
  CodeTofeSof,
  CompteSuiviSaisie,
  CompteSuiviSof,
  ExclusionRapSaisie,
  ExclusionRapSof,
  ExerciceSof,
  ExerciceSofSaisie,
  OngletFlechage,
  PeriodeSof,
  RegleFlechageSaisie,
  RegleFlechageSof,
  RubriqueDepenseNoeud,
  RubriqueRecetteNoeud,
  RubriqueSofCreation,
  RubriqueSofSaisie,
  PosteComptableSaisie,
  PosteComptableSof,
  SocietePetroliereSaisie,
  SocietePetroliereSof,
  StatutPeriodeSof,
  TestFlechageResultat,
  TypeExclusionRap,
} from "@/portails/Sof/types/referentiel.interface";

export function listerRubriquesRecettes(): Promise<{ rubriques: RubriqueRecetteNoeud[] }> {
  return requeteApi(SERVICE_OPERATIONS_ENDPOINTS.RUBRIQUES_RECETTES);
}

export function listerRubriquesDepenses(): Promise<{ rubriques: RubriqueDepenseNoeud[] }> {
  return requeteApi(SERVICE_OPERATIONS_ENDPOINTS.RUBRIQUES_DEPENSES);
}

export function creerRubriqueRecette(
  donnees: RubriqueSofCreation,
): Promise<{ rubrique: RubriqueRecetteNoeud }> {
  return requeteApi(SERVICE_OPERATIONS_ENDPOINTS.RUBRIQUES_RECETTES, {
    method: "POST",
    body: JSON.stringify(donnees),
  });
}

export function creerRubriqueDepense(
  donnees: RubriqueSofCreation,
): Promise<{ rubrique: RubriqueDepenseNoeud }> {
  return requeteApi(SERVICE_OPERATIONS_ENDPOINTS.RUBRIQUES_DEPENSES, {
    method: "POST",
    body: JSON.stringify(donnees),
  });
}

export function enregistrerRubriqueRecette(
  code: string,
  donnees: RubriqueSofSaisie,
): Promise<{ rubrique: RubriqueRecetteNoeud }> {
  return requeteApi(
    `${SERVICE_OPERATIONS_ENDPOINTS.RUBRIQUES_RECETTES}/${encodeURIComponent(code)}`,
    { method: "PUT", body: JSON.stringify(donnees) },
  );
}

export function enregistrerRubriqueDepense(
  code: string,
  donnees: RubriqueSofSaisie,
): Promise<{ rubrique: RubriqueDepenseNoeud }> {
  return requeteApi(
    `${SERVICE_OPERATIONS_ENDPOINTS.RUBRIQUES_DEPENSES}/${encodeURIComponent(code)}`,
    { method: "PUT", body: JSON.stringify(donnees) },
  );
}

export function reordonnerRubriquesRecettes(
  parentCode: string | null,
  codes: string[],
): Promise<{ rubriques: RubriqueRecetteNoeud[] }> {
  return requeteApi(`${SERVICE_OPERATIONS_ENDPOINTS.RUBRIQUES_RECETTES}/reordonner`, {
    method: "PUT",
    body: JSON.stringify({ parent_code: parentCode, codes }),
  });
}

export function reordonnerRubriquesDepenses(
  parentCode: string | null,
  codes: string[],
): Promise<{ rubriques: RubriqueDepenseNoeud[] }> {
  return requeteApi(`${SERVICE_OPERATIONS_ENDPOINTS.RUBRIQUES_DEPENSES}/reordonner`, {
    method: "PUT",
    body: JSON.stringify({ parent_code: parentCode, codes }),
  });
}

export function listerCodesTofe(): Promise<{ codes: CodeTofeSof[] }> {
  return requeteApi(SERVICE_OPERATIONS_ENDPOINTS.CODES_TOFE);
}

export function creerCodeTofe(donnees: {
  code: string;
  libelle: string;
}): Promise<{ code_tofe: CodeTofeSof }> {
  return requeteApi(SERVICE_OPERATIONS_ENDPOINTS.CODES_TOFE, {
    method: "POST",
    body: JSON.stringify(donnees),
  });
}

export function enregistrerCodeTofe(
  code: string,
  donnees: { libelle: string },
): Promise<{ code_tofe: CodeTofeSof }> {
  return requeteApi(
    `${SERVICE_OPERATIONS_ENDPOINTS.CODES_TOFE}/${encodeURIComponent(code)}`,
    { method: "PUT", body: JSON.stringify(donnees) },
  );
}

export function supprimerCodeTofe(code: string): Promise<void> {
  return requeteApi(
    `${SERVICE_OPERATIONS_ENDPOINTS.CODES_TOFE}/${encodeURIComponent(code)}`,
    { method: "DELETE" },
  );
}

export function listerReglesFlechage(
  onglet?: OngletFlechage,
): Promise<{ regles: RegleFlechageSof[] }> {
  const q = onglet ? `?onglet=${encodeURIComponent(onglet)}` : "";
  return requeteApi(`${SERVICE_OPERATIONS_ENDPOINTS.REGLES_FLECHAGE}${q}`);
}

export function creerRegleFlechage(
  donnees: RegleFlechageSaisie,
): Promise<{ regle: RegleFlechageSof }> {
  return requeteApi(SERVICE_OPERATIONS_ENDPOINTS.REGLES_FLECHAGE, {
    method: "POST",
    body: JSON.stringify(donnees),
  });
}

export function enregistrerRegleFlechage(
  id: number,
  donnees: Partial<RegleFlechageSaisie>,
): Promise<{ regle: RegleFlechageSof }> {
  return requeteApi(`${SERVICE_OPERATIONS_ENDPOINTS.REGLES_FLECHAGE}/${id}`, {
    method: "PUT",
    body: JSON.stringify(donnees),
  });
}

export function testerRegleFlechage(donnees: {
  compte?: string;
  categorie?: string;
  nature?: string;
  sens?: string;
}): Promise<{ resultat: TestFlechageResultat }> {
  return requeteApi(`${SERVICE_OPERATIONS_ENDPOINTS.REGLES_FLECHAGE}/tester`, {
    method: "POST",
    body: JSON.stringify(donnees),
  });
}

export function couvertureReglesFlechage(): Promise<{
  couverture: import("@/portails/Sof/types/referentiel.interface").CouvertureFlechage;
}> {
  return requeteApi(`${SERVICE_OPERATIONS_ENDPOINTS.REGLES_FLECHAGE}/couverture`);
}

export function listerTablesDecisionFlechage(): Promise<{
  tables: Record<string, Array<Record<string, string>>>;
}> {
  return requeteApi(`${SERVICE_OPERATIONS_ENDPOINTS.REGLES_FLECHAGE}/tables-decision`);
}

export function listerComptesSuivi(): Promise<{ comptes: CompteSuiviSof[] }> {
  return requeteApi(SERVICE_OPERATIONS_ENDPOINTS.COMPTES_SUIVI);
}

export function creerCompteSuivi(
  donnees: CompteSuiviSaisie,
): Promise<{ compte: CompteSuiviSof }> {
  return requeteApi(SERVICE_OPERATIONS_ENDPOINTS.COMPTES_SUIVI, {
    method: "POST",
    body: JSON.stringify(donnees),
  });
}

export function enregistrerCompteSuivi(
  compte: string,
  nature: string,
  donnees: Partial<Omit<CompteSuiviSaisie, "compte" | "nature">>,
): Promise<{ compte: CompteSuiviSof }> {
  return requeteApi(
    `${SERVICE_OPERATIONS_ENDPOINTS.COMPTES_SUIVI}/${encodeURIComponent(compte)}/${encodeURIComponent(nature)}`,
    { method: "PUT", body: JSON.stringify(donnees) },
  );
}

export function supprimerCompteSuivi(
  compte: string,
  nature: string,
): Promise<void> {
  return requeteApi(
    `${SERVICE_OPERATIONS_ENDPOINTS.COMPTES_SUIVI}/${encodeURIComponent(compte)}/${encodeURIComponent(nature)}`,
    { method: "DELETE" },
  );
}

export function listerSocietesPetrolieres(): Promise<{
  societes: SocietePetroliereSof[];
}> {
  return requeteApi(SERVICE_OPERATIONS_ENDPOINTS.SOCIETES_PETROLIERES);
}

export function creerSocietePetroliere(
  donnees: SocietePetroliereSaisie,
): Promise<{ societe: SocietePetroliereSof }> {
  return requeteApi(SERVICE_OPERATIONS_ENDPOINTS.SOCIETES_PETROLIERES, {
    method: "POST",
    body: JSON.stringify(donnees),
  });
}

export function enregistrerSocietePetroliere(
  matricule: string,
  donnees: Partial<Omit<SocietePetroliereSaisie, "matricule">>,
): Promise<{ societe: SocietePetroliereSof }> {
  return requeteApi(
    `${SERVICE_OPERATIONS_ENDPOINTS.SOCIETES_PETROLIERES}/${encodeURIComponent(matricule)}`,
    { method: "PUT", body: JSON.stringify(donnees) },
  );
}

export function supprimerSocietePetroliere(matricule: string): Promise<void> {
  return requeteApi(
    `${SERVICE_OPERATIONS_ENDPOINTS.SOCIETES_PETROLIERES}/${encodeURIComponent(matricule)}`,
    { method: "DELETE" },
  );
}

export function listerPostesComptables(): Promise<{ postes: PosteComptableSof[] }> {
  return requeteApi(SERVICE_OPERATIONS_ENDPOINTS.POSTES_COMPTABLES);
}

export function creerPosteComptable(
  donnees: PosteComptableSaisie,
): Promise<{ poste: PosteComptableSof }> {
  return requeteApi(SERVICE_OPERATIONS_ENDPOINTS.POSTES_COMPTABLES, {
    method: "POST",
    body: JSON.stringify(donnees),
  });
}

export function enregistrerPosteComptable(
  code: string,
  donnees: Partial<Omit<PosteComptableSaisie, "code">>,
): Promise<{ poste: PosteComptableSof }> {
  return requeteApi(
    `${SERVICE_OPERATIONS_ENDPOINTS.POSTES_COMPTABLES}/${encodeURIComponent(code)}`,
    { method: "PUT", body: JSON.stringify(donnees) },
  );
}

export function supprimerPosteComptable(code: string): Promise<void> {
  return requeteApi(
    `${SERVICE_OPERATIONS_ENDPOINTS.POSTES_COMPTABLES}/${encodeURIComponent(code)}`,
    { method: "DELETE" },
  );
}

export function listerPeriodes(exerciceAnnee?: number): Promise<{ periodes: PeriodeSof[] }> {
  const q =
    exerciceAnnee != null
      ? `?exercice=${encodeURIComponent(String(exerciceAnnee))}`
      : "";
  return requeteApi(`${SERVICE_OPERATIONS_ENDPOINTS.PERIODES}${q}`);
}

export function ouvrirPeriode(
  exerciceAnnee: number,
  mois: number,
): Promise<{ periode: PeriodeSof }> {
  return requeteApi(SERVICE_OPERATIONS_ENDPOINTS.PERIODES, {
    method: "POST",
    body: JSON.stringify({ exercice_annee: exerciceAnnee, mois }),
  });
}

export function enregistrerPeriode(
  id: number,
  donnees: { statut?: StatutPeriodeSof; date_situation?: string | null },
): Promise<{ periode: PeriodeSof }> {
  return requeteApi(`${SERVICE_OPERATIONS_ENDPOINTS.PERIODES}/${id}`, {
    method: "PUT",
    body: JSON.stringify(donnees),
  });
}

export function listerExercices(): Promise<{ exercices: ExerciceSof[] }> {
  return requeteApi(SERVICE_OPERATIONS_ENDPOINTS.EXERCICES);
}

export function obtenirExerciceCourant(): Promise<{ exercice: ExerciceSof | null }> {
  return requeteApi(`${SERVICE_OPERATIONS_ENDPOINTS.EXERCICES}/courant`);
}

export function obtenirExercice(annee: number): Promise<{ exercice: ExerciceSof }> {
  return requeteApi(`${SERVICE_OPERATIONS_ENDPOINTS.EXERCICES}/${annee}`);
}

export function enregistrerExercice(
  annee: number,
  donnees: ExerciceSofSaisie,
): Promise<{ exercice: ExerciceSof }> {
  return requeteApi(`${SERVICE_OPERATIONS_ENDPOINTS.EXERCICES}/${annee}`, {
    method: "PUT",
    body: JSON.stringify(donnees),
  });
}

export function ouvrirNouvelExercice(
  anneeSource?: number,
): Promise<{ exercice: ExerciceSof }> {
  return requeteApi(SERVICE_OPERATIONS_ENDPOINTS.EXERCICES, {
    method: "POST",
    body: JSON.stringify(anneeSource != null ? { annee_source: anneeSource } : {}),
  });
}

export function cloturerExercice(annee: number): Promise<{ exercice: ExerciceSof }> {
  return requeteApi(`${SERVICE_OPERATIONS_ENDPOINTS.EXERCICES}/${annee}/cloturer`, {
    method: "POST",
    body: JSON.stringify({}),
  });
}

export function listerExclusionsRap(
  type?: TypeExclusionRap,
): Promise<{
  exclusions: ExclusionRapSof[];
  regles_fixes?: import("@/portails/Sof/types/referentiel.interface").RegleFixeRap[];
  natures?: ExclusionRapSof[];
}> {
  const q = type ? `?type=${encodeURIComponent(type)}` : "";
  return requeteApi(`${SERVICE_OPERATIONS_ENDPOINTS.EXCLUSIONS_RAP}${q}`);
}

export function creerExclusionRap(
  donnees: ExclusionRapSaisie,
): Promise<{ exclusion: ExclusionRapSof }> {
  return requeteApi(SERVICE_OPERATIONS_ENDPOINTS.EXCLUSIONS_RAP, {
    method: "POST",
    body: JSON.stringify(donnees),
  });
}

export function supprimerExclusionRap(
  id: number,
  motif?: string,
): Promise<void> {
  return requeteApi(`${SERVICE_OPERATIONS_ENDPOINTS.EXCLUSIONS_RAP}/${id}`, {
    method: "DELETE",
    body: JSON.stringify(motif ? { motif } : {}),
  });
}

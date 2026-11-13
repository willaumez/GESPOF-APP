import { requeteApi } from "@/shared/lib/api";
import { SERVICE_OPERATIONS_ENDPOINTS } from "./endpoints";

export type NatureAjustement = "RECETTE" | "DEPENSE";

export type CodeAjustementNomenclature = {
  code: string;
  libelle: string;
  niveau: number | null;
  code_srot: string | null;
};

export type OperationAjustement = {
  id: number;
  reference: string;
  date: string;
  nature: NatureAjustement;
  nature_libelle: string;
  code_ajustement: string;
  code_srot: string | null;
  libelle: string | null;
  montant: string;
  motif: string;
  contre_passation_de_id: number | null;
  cree_le: string;
};

export function listerNomenclatureAjustements(
  nature?: NatureAjustement,
): Promise<{
  nomenclature: Partial<
    Record<NatureAjustement, CodeAjustementNomenclature[]>
  >;
}> {
  const q = nature ? `?nature=${nature}` : "";
  return requeteApi(
    `${SERVICE_OPERATIONS_ENDPOINTS.AJUSTEMENTS}/nomenclature${q}`,
  );
}

export function listerAjustements(periodeId?: number): Promise<{
  periode: {
    id: number;
    exercice_annee: number;
    mois: number;
    statut: string;
  } | null;
  verrouillee: boolean;
  operations: OperationAjustement[];
  message: string | null;
}> {
  const q = periodeId != null ? `?periode_id=${periodeId}` : "";
  return requeteApi(`${SERVICE_OPERATIONS_ENDPOINTS.AJUSTEMENTS}${q}`);
}

export function creerAjustement(donnees: {
  periode_id?: number;
  nature: NatureAjustement;
  code_ajustement: string;
  montant: string | number;
  motif: string;
  date?: string;
}): Promise<{ operation: OperationAjustement }> {
  return requeteApi(SERVICE_OPERATIONS_ENDPOINTS.AJUSTEMENTS, {
    method: "POST",
    body: JSON.stringify(donnees),
  });
}

export function contrePasserAjustement(
  id: number,
  motif?: string,
): Promise<{ operation: OperationAjustement }> {
  return requeteApi(
    `${SERVICE_OPERATIONS_ENDPOINTS.AJUSTEMENTS}/${id}/contre-passer`,
    {
      method: "POST",
      body: JSON.stringify(motif ? { motif } : {}),
    },
  );
}

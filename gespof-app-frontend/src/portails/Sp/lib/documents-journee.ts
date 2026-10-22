import JSZip from "jszip";
import { requeteApiBlob } from "@/shared/lib/api";
import { SERVICE_PREVISION_ENDPOINTS } from "@/portails/Sp/api/endpoints";
import { detailFicheBleue } from "@/portails/Sp/api/fiches-bleues";
import { detailFicheDepot } from "@/portails/Sp/api/fiches-depot";
import { detailFicheExecution } from "@/portails/Sp/api/fiches-execution";
import { imprimerFicheSections } from "@/portails/Sp/lib/imprimer-fiche-sections";
import { declencherTelechargementBlob } from "@/portails/Sp/lib/imprimer-html";
import { imprimerFicheDepot } from "@/portails/Sr/lib/imprimer-fiche-depot";
import type { FicheDepotDetail } from "@/portails/Sr/types";
import type { FicheDepotResumeSp } from "@/portails/Sp/types/fiche-depot.interface";
import type { JourneeTresorerie } from "@/portails/Sp/types/journee-tresorerie.interface";

function urlTelechargerDepot(reference: string): string {
  return `${SERVICE_PREVISION_ENDPOINTS.FICHES_DEPOT}/${encodeURIComponent(reference)}/telecharger`;
}

function urlTelechargerBleue(id: number): string {
  return `${SERVICE_PREVISION_ENDPOINTS.FICHES_BLEUES}/${id}/telecharger`;
}

function urlTelechargerExecution(id: number): string {
  return `${SERVICE_PREVISION_ENDPOINTS.FICHES_EXECUTION}/${id}/telecharger`;
}

export async function telechargerFicheDepotSp(reference: string): Promise<void> {
  const blob = await requeteApiBlob(urlTelechargerDepot(reference), {
    timeoutMs: 180_000,
  });
  declencherTelechargementBlob(blob, `${reference}.xlsx`);
}

export async function imprimerFicheDepotSp(reference: string): Promise<void> {
  const detail = await detailFicheDepot(reference);
  imprimerFicheDepot(detail as unknown as FicheDepotDetail);
}

export async function telechargerFichesDepotSp(
  fiches: FicheDepotResumeSp[],
): Promise<void> {
  if (fiches.length === 0) throw new Error("Aucune fiche de dépôt à télécharger.");
  if (fiches.length === 1) {
    await telechargerFicheDepotSp(fiches[0].reference);
    return;
  }
  const zip = new JSZip();
  const dossier = zip.folder("fiches-depot");
  if (!dossier) throw new Error("Impossible de préparer l'archive.");
  for (const f of fiches) {
    const blob = await requeteApiBlob(urlTelechargerDepot(f.reference), {
      timeoutMs: 180_000,
    });
    dossier.file(`${f.reference}.xlsx`, blob);
  }
  const archive = await zip.generateAsync({ type: "blob" });
  declencherTelechargementBlob(archive, "fiches-depot.zip");
}

export async function imprimerFichesDepotSp(
  fiches: Array<FicheDepotResumeSp | { reference: string } | string>,
): Promise<void> {
  if (fiches.length === 0) throw new Error("Aucune fiche de dépôt à imprimer.");
  const premiere = fiches[0];
  const reference =
    typeof premiere === "string" ? premiere : premiere.reference;
  // Une seule boîte d'impression : la première fiche (les autres via Détail / ZIP).
  await imprimerFicheDepotSp(reference);
}

export async function telechargerFicheBleueSp(id: number): Promise<void> {
  const { fiche } = await detailFicheBleue(id);
  const blob = await requeteApiBlob(urlTelechargerBleue(id), {
    timeoutMs: 180_000,
  });
  declencherTelechargementBlob(blob, `${fiche.reference}.xlsx`);
}

export async function imprimerFicheBleueSp(id: number): Promise<void> {
  const { fiche } = await detailFicheBleue(id);
  imprimerFicheSections({
    titre: "Fiche Bleue",
    reference: fiche.reference,
    meta: `Créée le ${fiche.date_creation} · ${fiche.createur}`,
    totalProgramme: fiche.montant_total_programme,
    totalRealise: fiche.montant_total_realise,
    totalEcart: fiche.montant_total_ecart,
    sections: fiche.sections,
  });
}

export async function telechargerFicheExecutionSp(id: number): Promise<void> {
  const { fiche } = await detailFicheExecution(id);
  const blob = await requeteApiBlob(urlTelechargerExecution(id), {
    timeoutMs: 180_000,
  });
  declencherTelechargementBlob(blob, `${fiche.reference}.xlsx`);
}

export async function imprimerFicheExecutionSp(id: number): Promise<void> {
  const { fiche } = await detailFicheExecution(id);
  imprimerFicheSections({
    titre: "Fiche d'exécution",
    reference: fiche.reference,
    meta: `Créée le ${fiche.date_creation} · ${fiche.createur}`,
    totalProgramme: fiche.montant_total_programme,
    totalRealise: fiche.montant_total_realise,
    totalEcart: fiche.montant_total_ecart,
    sections: fiche.sections,
  });
}

/** Archive ZIP : dossier = référence journée, avec tous les fichiers disponibles. */
export async function telechargerTousDocumentsJournee(params: {
  journee: JourneeTresorerie;
  depots: FicheDepotResumeSp[];
}): Promise<void> {
  const { journee, depots } = params;
  const zip = new JSZip();
  const dossier = zip.folder(journee.reference);
  if (!dossier) throw new Error("Impossible de préparer l'archive.");

  let fichiers = 0;

  if (journee.fiche_bleue_id != null) {
    const { fiche } = await detailFicheBleue(journee.fiche_bleue_id);
    const blob = await requeteApiBlob(urlTelechargerBleue(journee.fiche_bleue_id), {
      timeoutMs: 180_000,
    });
    dossier.file(`${fiche.reference}.xlsx`, blob);
    fichiers += 1;
  }

  for (const f of depots) {
    const blob = await requeteApiBlob(urlTelechargerDepot(f.reference), {
      timeoutMs: 180_000,
    });
    dossier.file(`depots/${f.reference}.xlsx`, blob);
    fichiers += 1;
  }

  if (journee.fiche_execution_id != null) {
    const { fiche } = await detailFicheExecution(journee.fiche_execution_id);
    const blob = await requeteApiBlob(
      urlTelechargerExecution(journee.fiche_execution_id),
      { timeoutMs: 180_000 },
    );
    dossier.file(`${fiche.reference}.xlsx`, blob);
    fichiers += 1;
  }

  if (fichiers === 0) {
    throw new Error("Aucun document disponible pour cette journée.");
  }

  const archive = await zip.generateAsync({ type: "blob" });
  declencherTelechargementBlob(archive, `${journee.reference}.zip`);
}

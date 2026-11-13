import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Inbox } from "lucide-react";
import { toast } from "sonner";
import { requeteApi, requeteApiBlob } from "@/shared/lib/api";
import { SERVICE_REGLEMENT_ENDPOINTS } from "@/portails/Sr/api/endpoints";
import { useAuth } from "@/shared/hooks/use-auth";
import { useCountUp } from "@/portails/Sr/hooks/useCountUp";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/shared/components/ui/empty";
import type { DonneesMouvement, FicheDepotDetail, LigneMouvement } from "@/portails/Sr/types";
import type { SectionMouvement, TypeMouvement } from "../components/fiche-detail/constants";
import { parseMontant } from "../components/fiche-detail/utils";
import { FicheEnTete } from "../components/fiche-detail/FicheEnTete";
import { ReleveReglements } from "../components/fiche-detail/ReleveReglements";
import { FamilleDialog } from "../components/fiche-detail/FamilleDialog";
import { ConfirmerEnvoiDialog } from "../components/fiche-detail/ConfirmerEnvoiDialog";
import { ConfirmerSuppressionFicheDialog } from "../components/fiche-detail/ConfirmerSuppressionFicheDialog";
import { detailFicheRecue, ficheRecuePourDate } from "@/portails/Sr/api/fiches-recues";
import { PreviewFicheBleueDialog } from "@/portails/Sp/components/fiche-matinale/PreviewFicheBleueDialog";
import type { LigneRapprochement } from "@/portails/Sp/components/fiche-matinale/rapprochement-sections";
import { imprimerFicheDepot } from "@/portails/Sr/lib/imprimer-fiche-depot";
import { nomFichierFicheDepot } from "@/portails/Sr/lib/exporter-fiche-depot-xlsx";
import { OverlayPleinEcran } from "@/portails/Sp/components/plein-ecran/PleinEcran";

/** `d/m/Y` ou `Y-m-d` (éventuellement suivi d'une heure) → `Y-m-d`. */
function datePresentationVersIso(valeur: string | null | undefined): string | null {
  if (!valeur) return null;
  const [jourMoisAnnee] = valeur.trim().split(/[\sT]/);
  const brut = jourMoisAnnee ?? "";

  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(brut);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;

  const [j, m, a] = brut.split("/");
  return j && m && a ? `${a}-${m.padStart(2, "0")}-${j.padStart(2, "0")}` : null;
}

function enTableau<T>(valeur: T[] | Record<string, T> | null | undefined): T[] {
  if (Array.isArray(valeur)) return valeur;
  if (valeur && typeof valeur === "object") return Object.values(valeur);
  return [];
}

function extraireLignesRapprochement(detail: FicheDepotDetail): LigneRapprochement[] {
  const lignes: LigneRapprochement[] = [];
  const ajouter = (libelle: string | null | undefined, montant: number) => {
    const nom = (libelle ?? "").trim();
    if (!nom) return;
    lignes.push({ libelle: nom, montant });
  };

  for (const l of enTableau(detail.mouvements_numeraire)) {
    ajouter(l.beneficiaire, l.depenses);
  }
  for (const l of enTableau(detail.mouvements_sygma)) {
    ajouter(l.beneficiaire, l.depenses);
  }
  for (const l of enTableau(detail.mouvements_systac)) {
    ajouter(l.designation || l.beneficiaire, l.montant_groupe ?? l.depenses);
  }
  for (const l of enTableau(detail.lignes_systac)) {
    if (l.l_orig && l.l_orig.trim() && l.l_orig !== l.designation) {
      ajouter(l.l_orig, l.montant_groupe);
    }
  }
  return lignes;
}

export default function FicheDetail() {
  const navigate = useNavigate();
  const { reference } = useParams<{ reference?: string }>();
  const { hasRole } = useAuth();
  const estAdministrateur = hasRole("ADMINISTRATEUR");

  const [detail, setDetail] = useState<FicheDepotDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [telechargementEnCours, setTelechargementEnCours] = useState(false);
  const [pleinEcranReleve, setPleinEcranReleve] = useState(false);
  const [familleDialog, setFamilleDialog] = useState<TypeMouvement | null>(null);
  const [confirmationSuppression, setConfirmationSuppression] = useState(false);
  const [suppressionEnCours, setSuppressionEnCours] = useState(false);
  const [confirmationEnvoi, setConfirmationEnvoi] = useState(false);
  const [envoiEnCours, setEnvoiEnCours] = useState(false);

  const [idsSystacSelection, setIdsSystacSelection] = useState<number[]>([]);
  const [idsMouvementSelection, setIdsMouvementSelection] = useState<number[]>([]);
  const [ajoutEnCours, setAjoutEnCours] = useState(false);
  const [regroupementEnCours, setRegroupementEnCours] = useState(false);
  const [suppressionSelectionEnCours, setSuppressionSelectionEnCours] = useState(false);
  const [apercuFicheBleueId, setApercuFicheBleueId] = useState<number | null>(null);
  const [chargementFicheBleue, setChargementFicheBleue] = useState(false);

  const numeraireAnime = useCountUp(parseMontant(detail?.total_numeraire));
  const sigmaAnime = useCountUp(parseMontant(detail?.total_sigma));
  const systacAnime = useCountUp(parseMontant(detail?.total_systac));
  const totalAnime = useCountUp(parseMontant(detail?.montant_total));

  const ouvrirFicheBleue = async () => {
    if (!detail || chargementFicheBleue) return;
    if (detail.fiche_recue) {
      setApercuFicheBleueId(detail.fiche_recue.id);
      return;
    }

    const dateIso = datePresentationVersIso(detail.date_presentation);
    if (!dateIso) {
      setApercuFicheBleueId(0);
      return;
    }

    setChargementFicheBleue(true);
    try {
      const { fiche } = await ficheRecuePourDate(dateIso);
      setApercuFicheBleueId(fiche?.id ?? 0);
    } catch {
      setApercuFicheBleueId(0);
    } finally {
      setChargementFicheBleue(false);
    }
  };

  const confirmerEnvoi = async () => {
    if (!reference) return;
    setEnvoiEnCours(true);
    try {
      await requeteApi<{ ok: boolean; statut: string }>(
        `${SERVICE_REGLEMENT_ENDPOINTS.FICHE_DETAIL}/${encodeURIComponent(reference)}/statut`,
        { method: "POST", body: JSON.stringify({ statut: "envoyee" }) },
      );
      setDetail((d) => (d ? { ...d, statut: "envoyee" } : d));
      toast.success("Fiche de dépôt envoyée.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur lors de l'envoi.");
    } finally {
      setEnvoiEnCours(false);
      setConfirmationEnvoi(false);
    }
  };

  const confirmerSuppression = async () => {
    if (!reference) return;
    setSuppressionEnCours(true);
    try {
      await requeteApi<{ ok: boolean }>(
        `${SERVICE_REGLEMENT_ENDPOINTS.FICHE_DETAIL}/${encodeURIComponent(reference)}`,
        { method: "DELETE" },
      );
      toast.success("Fiche de dépôt supprimée.");
      navigate("/sr/fiches-depenses");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur lors de la suppression.");
    } finally {
      setSuppressionEnCours(false);
      setConfirmationSuppression(false);
    }
  };

  const normaliserDetail = (data: FicheDepotDetail): FicheDepotDetail => ({
    ...data,
    mouvements_numeraire: enTableau(data.mouvements_numeraire),
    mouvements_sygma: enTableau(data.mouvements_sygma),
    mouvements_systac: enTableau(data.mouvements_systac),
    lignes_systac: enTableau(data.lignes_systac),
  });

  const appliquerDetail = (data: FicheDepotDetail) => {
    setDetail(normaliserDetail(data));
  };

  const modifierLigneSystac = async (
    id: number,
    champs: Partial<
      Record<
        | "c_orig"
        | "l_orig"
        | "n_bv"
        | "nb_regl"
        | "montant_systac"
        | "montant_groupe"
        | "designation"
        | "d_generation",
        string | number | null
      >
    >,
  ) => {
    if (!reference) return;
    try {
      const data = await requeteApi<FicheDepotDetail>(
        `${SERVICE_REGLEMENT_ENDPOINTS.FICHE_DETAIL}/${encodeURIComponent(reference)}/lignes-systac/${id}`,
        { method: "PUT", body: JSON.stringify(champs) },
      );
      appliquerDetail(data);
      toast.success("Ligne mise à jour.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Impossible de modifier la ligne.");
    }
  };

  const ajouterLigneSystac = async () => {
    if (!reference || ajoutEnCours) return;
    setAjoutEnCours(true);
    try {
      const data = await requeteApi<FicheDepotDetail>(
        `${SERVICE_REGLEMENT_ENDPOINTS.FICHE_DETAIL}/${encodeURIComponent(reference)}/lignes-systac`,
        { method: "POST", body: JSON.stringify({}) },
      );
      appliquerDetail(data);
      toast.success("Ligne ajoutée.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Impossible d'ajouter la ligne.");
    } finally {
      setAjoutEnCours(false);
    }
  };

  const ajouterMouvement = async (famille: "numeraire" | "sigma") => {
    if (!reference || ajoutEnCours) return;
    const familleApi = famille === "sigma" ? "sygma" : "numeraire";
    setAjoutEnCours(true);
    try {
      const data = await requeteApi<FicheDepotDetail>(
        `${SERVICE_REGLEMENT_ENDPOINTS.FICHE_DETAIL}/${encodeURIComponent(reference)}/mouvements/${familleApi}`,
        {
          method: "POST",
          body: JSON.stringify({
            beneficiaire: "Nouvelle ligne",
            depenses: 0,
          }),
        },
      );
      appliquerDetail(data);
      toast.success("Ligne ajoutée.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Impossible d'ajouter la ligne.");
    } finally {
      setAjoutEnCours(false);
    }
  };

  const modifierMouvement = async (ligne: LigneMouvement, donnees: DonneesMouvement) => {
    if (!reference || (familleDialog !== "numeraire" && familleDialog !== "sigma")) return;
    const familleApi = familleDialog === "sigma" ? "sygma" : "numeraire";
    try {
      const data = await requeteApi<FicheDepotDetail>(
        `${SERVICE_REGLEMENT_ENDPOINTS.FICHE_DETAIL}/${encodeURIComponent(reference)}/mouvements/${familleApi}/${ligne.id}`,
        { method: "PUT", body: JSON.stringify(donnees) },
      );
      appliquerDetail(data);
      toast.success("Ligne mise à jour.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Impossible de modifier la ligne.");
    }
  };

  const regrouperLignesSystac = async () => {
    if (!reference || idsSystacSelection.length < 2 || regroupementEnCours) return;
    setRegroupementEnCours(true);
    try {
      const data = await requeteApi<FicheDepotDetail>(
        `${SERVICE_REGLEMENT_ENDPOINTS.FICHE_DETAIL}/${encodeURIComponent(reference)}/lignes-systac/regrouper`,
        { method: "POST", body: JSON.stringify({ ids: idsSystacSelection }) },
      );
      setIdsSystacSelection([]);
      appliquerDetail(data);
      toast.success("Lignes regroupées.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Impossible de regrouper ces lignes.");
    } finally {
      setRegroupementEnCours(false);
    }
  };

  const supprimerSelection = async () => {
    if (!reference || suppressionSelectionEnCours) return;

    if (familleDialog === "systac") {
      if (idsSystacSelection.length < 1) return;
      const nb = idsSystacSelection.length;
      setSuppressionSelectionEnCours(true);
      try {
        const data = await requeteApi<FicheDepotDetail>(
          `${SERVICE_REGLEMENT_ENDPOINTS.FICHE_DETAIL}/${encodeURIComponent(reference)}/lignes-systac/supprimer`,
          { method: "POST", body: JSON.stringify({ ids: idsSystacSelection }) },
        );
        setIdsSystacSelection([]);
        appliquerDetail(data);
        toast.success(nb > 1 ? "Lignes supprimées." : "Ligne supprimée.");
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Impossible de supprimer la sélection.");
      } finally {
        setSuppressionSelectionEnCours(false);
      }
      return;
    }

    if (familleDialog !== "numeraire" && familleDialog !== "sigma") return;
    if (idsMouvementSelection.length < 1) return;

    const nb = idsMouvementSelection.length;
    const familleApi = familleDialog === "sigma" ? "sygma" : "numeraire";
    setSuppressionSelectionEnCours(true);
    try {
      const data = await requeteApi<FicheDepotDetail>(
        `${SERVICE_REGLEMENT_ENDPOINTS.FICHE_DETAIL}/${encodeURIComponent(reference)}/mouvements/${familleApi}/supprimer`,
        { method: "POST", body: JSON.stringify({ ids: idsMouvementSelection }) },
      );
      setIdsMouvementSelection([]);
      appliquerDetail(data);
      toast.success(nb > 1 ? "Lignes supprimées." : "Ligne supprimée.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Impossible de supprimer la sélection.");
    } finally {
      setSuppressionSelectionEnCours(false);
    }
  };

  const regrouperMouvements = async () => {
    if (
      !reference ||
      idsMouvementSelection.length < 2 ||
      regroupementEnCours ||
      (familleDialog !== "numeraire" && familleDialog !== "sigma")
    ) {
      return;
    }
    const familleApi = familleDialog === "sigma" ? "sygma" : "numeraire";
    setRegroupementEnCours(true);
    try {
      const data = await requeteApi<FicheDepotDetail>(
        `${SERVICE_REGLEMENT_ENDPOINTS.FICHE_DETAIL}/${encodeURIComponent(reference)}/mouvements/${familleApi}/regrouper`,
        { method: "POST", body: JSON.stringify({ ids: idsMouvementSelection }) },
      );
      setIdsMouvementSelection([]);
      appliquerDetail(data);
      toast.success("Lignes regroupées.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Impossible de regrouper ces lignes.");
    } finally {
      setRegroupementEnCours(false);
    }
  };

  useEffect(() => {
    let actif = true;

    if (!reference) {
      Promise.resolve().then(() => {
        if (actif) setLoading(false);
      });
      return () => {
        actif = false;
      };
    }

    Promise.resolve().then(() => {
      if (!actif) return;
      setDetail(null);
      setLoading(true);
      setError(false);
    });

    requeteApi<FicheDepotDetail>(
      `${SERVICE_REGLEMENT_ENDPOINTS.FICHE_DETAIL}/${encodeURIComponent(reference)}`,
    )
      .then((data) => {
        if (actif) setDetail(normaliserDetail(data));
      })
      .catch(() => {
        if (actif) setError(true);
      })
      .finally(() => {
        if (actif) setLoading(false);
      });

    return () => {
      actif = false;
    };
  }, [reference]);

  if (!reference) {
    return (
      <Empty>
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <Inbox />
          </EmptyMedia>
          <EmptyTitle>Aucune fiche sélectionnée</EmptyTitle>
          <EmptyDescription>
            Choisissez une fiche depuis la liste pour en voir le détail.
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  const aDesActions = !loading && Boolean(detail);
  // Ces booleens ne portent plus que l'etat metier de la fiche (statut,
  // verrouillage) : l'affordance reste affichee a tout le monde des lors que
  // l'action est pertinente pour cette fiche. L'acces (qui a le droit de
  // cliquer) est verifie par les boutons eux-memes via BoutonAcces.
  const peutEnvoyerCetteFiche = !loading && detail?.statut === "cree";
  const ficheDejaEnvoyee = detail?.statut === "envoyee" || detail?.statut === "recue";
  const verrouilleeParEnvoi = ficheDejaEnvoyee && !estAdministrateur;
  const peutSupprimer = !ficheDejaEnvoyee;
  const peutGererLignes = !verrouilleeParEnvoi;
  const afficheBarreActions = !loading && Boolean(detail);

  const totalLignesAffichees = detail
    ? detail.mouvements_numeraire.length +
      detail.mouvements_sygma.length +
      detail.mouvements_systac.length
    : 0;

  const sections: SectionMouvement[] = detail
    ? [
        {
          type: "numeraire",
          lignes: detail.mouvements_numeraire,
          total: detail.total_numeraire,
          montant: numeraireAnime,
        },
        {
          type: "sigma",
          lignes: detail.mouvements_sygma,
          total: detail.total_sigma,
          montant: sigmaAnime,
        },
        {
          type: "systac",
          lignes: detail.mouvements_systac,
          total: detail.total_systac,
          totalGroupe: detail.total_groupe,
          montant: systacAnime,
        },
      ]
    : [];

  const totalLignesTableau = sections.reduce((n, s) => n + s.lignes.length, 0);
  const sectionDialog = sections.find((s) => s.type === familleDialog);

  const totauxSystacCorrespondent = detail
    ? Math.abs(parseMontant(detail.total_systac) - parseMontant(detail.total_groupe)) < 0.01
    : true;

  const lignesSystacDialog = detail?.lignes_systac ?? [];
  const dialogEnfantOuvert = false;
  const lignesRapprochement = useMemo(
    () => (detail ? extraireLignesRapprochement(detail) : []),
    [detail],
  );

  const imprimer = () => {
    if (!detail) return;
    try {
      imprimerFicheDepot(detail);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Impossible d'imprimer la fiche.",
      );
    }
  };

  const telechargerXlsx = async () => {
    if (!detail || telechargementEnCours) return;
    setTelechargementEnCours(true);
    try {
      const chemin = `${SERVICE_REGLEMENT_ENDPOINTS.FICHE_DETAIL}/${encodeURIComponent(detail.reference)}/telecharger`;
      const blob = await requeteApiBlob(chemin, { timeoutMs: 180_000 });
      const url = URL.createObjectURL(blob);
      const lien = document.createElement("a");
      lien.href = url;
      lien.download = nomFichierFicheDepot(detail);
      document.body.appendChild(lien);
      lien.click();
      lien.remove();
      URL.revokeObjectURL(url);
      toast.success("Fichier Excel téléchargé.");
    } catch (err) {
      toast.error(
        err instanceof Error
          ? err.message
          : "Impossible de télécharger le fichier Excel.",
      );
    } finally {
      setTelechargementEnCours(false);
    }
  };

  return (
    <div className="flex w-full flex-col gap-6">
          <FicheEnTete
            reference={reference}
            detail={detail}
            loading={loading}
            aDesActions={aDesActions}
            peutEnvoyerCetteFiche={peutEnvoyerCetteFiche}
            pretPourEnvoiSp={totauxSystacCorrespondent}
            peutSupprimer={peutSupprimer}
            afficheBarreActions={afficheBarreActions}
            onImprimer={imprimer}
            onTelechargerXlsx={() => void telechargerXlsx()}
            telechargementEnCours={telechargementEnCours}
            onAjouterLigne={() => setFamilleDialog("numeraire")}
            onDemanderEnvoi={() => {
              if (!totauxSystacCorrespondent) {
                toast.error(
                  "Envoi impossible : le montant Systac ne correspond pas au montant groupé.",
                );
                return;
              }
              setConfirmationEnvoi(true);
            }}
            onDemanderSuppression={() => setConfirmationSuppression(true)}
            onOuvrirFicheBleue={() => void ouvrirFicheBleue()}
            chargementFicheBleue={chargementFicheBleue}
            peutPleinEcran={Boolean(detail && totalLignesTableau > 0)}
            pleinEcranActif={pleinEcranReleve}
            onBasculerPleinEcran={() => setPleinEcranReleve((v) => !v)}
          />

          <ReleveReglements
            detail={detail}
            loading={loading}
            error={error}
            sections={sections}
            totalLignesAffichees={totalLignesAffichees}
            totalLignesTableau={totalLignesTableau}
            totalAnime={totalAnime}
            totauxSystacCorrespondent={totauxSystacCorrespondent}
            onOuvrirFamille={setFamilleDialog}
            peutModifier={peutGererLignes}
            onModifierLigne={(type) => setFamilleDialog(type)}
          />

      {detail && totalLignesTableau > 0 ? (
        <OverlayPleinEcran
          ouvert={pleinEcranReleve}
          portail="sr"
          titre="Relevé des règlements"
          masquerEnTete
          onClose={() => setPleinEcranReleve(false)}
          ariaLabel="Relevé des règlements en plein écran"
        >
          <div className="flex h-full min-h-0 flex-col overflow-y-auto pt-8">
            <ReleveReglements
              detail={detail}
              loading={false}
              error={false}
              sections={sections}
              totalLignesAffichees={totalLignesAffichees}
              totalLignesTableau={totalLignesTableau}
              totalAnime={totalAnime}
              totauxSystacCorrespondent={totauxSystacCorrespondent}
              masquerEquation
              onOuvrirFamille={(type) => {
                setPleinEcranReleve(false);
                setFamilleDialog(type);
              }}
              peutModifier={peutGererLignes}
              onModifierLigne={(type) => {
                setPleinEcranReleve(false);
                setFamilleDialog(type);
              }}
            />
          </div>
        </OverlayPleinEcran>
      ) : null}

      <FamilleDialog
        familleDialog={familleDialog}
        onFermer={() => {
          setFamilleDialog(null);
          setIdsSystacSelection([]);
          setIdsMouvementSelection([]);
        }}
        sectionDialog={sectionDialog}
        lignesSystacDialog={lignesSystacDialog}
        detail={detail}
        totauxSystacCorrespondent={totauxSystacCorrespondent}
        peutGererLignes={peutGererLignes}
        dialogEnfantOuvert={dialogEnfantOuvert}
        idsSystacSelection={idsSystacSelection}
        onIdsSystacSelection={setIdsSystacSelection}
        idsMouvementSelection={idsMouvementSelection}
        onIdsMouvementSelection={setIdsMouvementSelection}
        onAjouterLigne={() => {
          if (familleDialog === "systac") void ajouterLigneSystac();
          else if (familleDialog === "numeraire" || familleDialog === "sigma") {
            void ajouterMouvement(familleDialog);
          }
        }}
        onModifierMouvement={(ligne, donnees) => void modifierMouvement(ligne, donnees)}
        onSupprimerSelection={() => void supprimerSelection()}
        onRegrouperSystac={() => void regrouperLignesSystac()}
        onRegrouperMouvements={() => void regrouperMouvements()}
        ajoutEnCours={ajoutEnCours}
        regroupementEnCours={regroupementEnCours}
        suppressionEnCours={suppressionSelectionEnCours}
        onModifierLigneSystac={(id, champs) => void modifierLigneSystac(id, champs)}
      />

      <ConfirmerEnvoiDialog
        ouvert={confirmationEnvoi}
        reference={reference}
        envoiEnCours={envoiEnCours}
        onOpenChange={(open) => !open && setConfirmationEnvoi(false)}
        onConfirmer={() => void confirmerEnvoi()}
      />

      <ConfirmerSuppressionFicheDialog
        ouvert={confirmationSuppression}
        reference={reference}
        suppressionEnCours={suppressionEnCours}
        onOpenChange={(open) => !open && setConfirmationSuppression(false)}
        onConfirmer={() => void confirmerSuppression()}
      />

      <PreviewFicheBleueDialog
        ficheId={apercuFicheBleueId}
        onClose={() => setApercuFicheBleueId(null)}
        chargerDetail={detailFicheRecue}
        portail="sr"
        lignesRapprochement={lignesRapprochement}
      />
    </div>
  );
}

import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Inbox } from "lucide-react";
import { toast } from "sonner";
import { requeteApi, requeteApiBlob } from "@/shared/lib/api";
import { SERVICE_REGLEMENT_ENDPOINTS } from "@/portails/Sr/api/endpoints";
import { useAuth } from "@/shared/hooks/use-auth";
import { useCountUp } from "@/portails/Sr/hooks/useCountUp";
import { Card, CardContent } from "@/shared/components/ui/card";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/shared/components/ui/empty";
import type { FicheDepotDetail, LigneMouvement } from "@/portails/Sr/types";
import type { SectionMouvement, TypeMouvement } from "../components/fiche-detail/constants";
import { parseMontant } from "../components/fiche-detail/utils";
import { FicheEnTete } from "../components/fiche-detail/FicheEnTete";
import { ReleveReglements } from "../components/fiche-detail/ReleveReglements";
import { FamilleDialog } from "../components/fiche-detail/FamilleDialog";
import { LigneFormulaireDialog } from "../components/fiche-detail/LigneFormulaireDialog";
import { ConfirmerSuppressionLigneDialog } from "../components/fiche-detail/ConfirmerSuppressionLigneDialog";
import { ConfirmerEnvoiDialog } from "../components/fiche-detail/ConfirmerEnvoiDialog";
import { ConfirmerSuppressionFicheDialog } from "../components/fiche-detail/ConfirmerSuppressionFicheDialog";

export default function FicheDetail() {
  const navigate = useNavigate();
  const { reference } = useParams<{ reference?: string }>();
  const { hasRole } = useAuth();
  const peutSupprimerRole = hasRole("CHEF_SR");
  const peutEnvoyer = hasRole("CHEF_SR");
  const peutGererLignesRole = hasRole("AGENT_SR");
  const estAdministrateur = hasRole("ADMINISTRATEUR");

  const [detail, setDetail] = useState<FicheDepotDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [chargementTelechargement, setChargementTelechargement] = useState(false);
  const [familleDialog, setFamilleDialog] = useState<TypeMouvement | null>(null);
  const [confirmationSuppression, setConfirmationSuppression] = useState(false);
  const [suppressionEnCours, setSuppressionEnCours] = useState(false);
  const [confirmationEnvoi, setConfirmationEnvoi] = useState(false);
  const [envoiEnCours, setEnvoiEnCours] = useState(false);

  const [ligneFormulaire, setLigneFormulaire] = useState<{
    mode: "creation" | "edition";
    famille: "numeraire" | "sigma";
    ligne?: LigneMouvement;
  } | null>(null);
  const [ligneASupprimer, setLigneASupprimer] = useState<{
    famille: "numeraire" | "sigma";
    ligne: LigneMouvement;
  } | null>(null);
  const [suppressionLigneEnCours, setSuppressionLigneEnCours] = useState(false);

  const numeraireAnime = useCountUp(parseMontant(detail?.total_numeraire));
  const sigmaAnime = useCountUp(parseMontant(detail?.total_sigma));
  const systacAnime = useCountUp(parseMontant(detail?.total_systac));
  const totalAnime = useCountUp(parseMontant(detail?.montant_total));

  const handleTelecharger = async () => {
    if (!detail?.url_telecharger || chargementTelechargement) return;
    setChargementTelechargement(true);
    try {
      const blob = await requeteApiBlob(detail.url_telecharger);
      const url = URL.createObjectURL(blob);
      const lien = document.createElement("a");
      lien.href = url;
      lien.download = `REGLEMENTS DU ${(detail?.date_presentation ?? "").replace(/\//g, "-")}.xlsx`;
      document.body.appendChild(lien);
      lien.click();
      lien.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Impossible de télécharger le fichier.");
    } finally {
      setChargementTelechargement(false);
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

  const rechargerDetail = useCallback(async () => {
    if (!reference) return;
    try {
      const data = await requeteApi<FicheDepotDetail>(
        `${SERVICE_REGLEMENT_ENDPOINTS.FICHE_DETAIL}/${encodeURIComponent(reference)}`,
      );
      setDetail(data);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur lors du rechargement de la fiche.");
    }
  }, [reference]);

  const confirmerSuppressionLigne = async () => {
    if (!ligneASupprimer || !reference) return;
    setSuppressionLigneEnCours(true);
    try {
      const familleApi = ligneASupprimer.famille === "sigma" ? "sygma" : "numeraire";
      await requeteApi<{ ok: boolean }>(
        `${SERVICE_REGLEMENT_ENDPOINTS.FICHE_DETAIL}/${encodeURIComponent(reference)}/mouvements/${familleApi}/${ligneASupprimer.ligne.id}`,
        { method: "DELETE" },
      );
      toast.success("Ligne supprimée.");
      await rechargerDetail();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur lors de la suppression de la ligne.");
    } finally {
      setSuppressionLigneEnCours(false);
      setLigneASupprimer(null);
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
        if (actif) setDetail(data);
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

  const aDesActions = !loading && Boolean(detail?.url_telecharger);
  const peutEnvoyerCetteFiche = peutEnvoyer && !loading && detail?.statut === "cree";
  const verrouilleeParEnvoi =
    (detail?.statut === "envoyee" || detail?.statut === "recue") && !estAdministrateur;
  const peutSupprimer = peutSupprimerRole && !verrouilleeParEnvoi;
  const peutGererLignes = peutGererLignesRole && !verrouilleeParEnvoi;
  const afficheBarreActions = !loading && (aDesActions || peutSupprimer || peutEnvoyerCetteFiche);

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
  const dialogEnfantOuvert = ligneFormulaire !== null || ligneASupprimer !== null;

  return (
    <div className="">
      <Card className="shadow-sm">
        <CardContent>
          <div className="flex min-h-0 flex-1 flex-col gap-4 animate-in fade-in-0 duration-300">
            <div className="shrink-0">
              <FicheEnTete
                reference={reference}
                detail={detail}
                loading={loading}
                chargementTelechargement={chargementTelechargement}
                aDesActions={aDesActions}
                peutEnvoyerCetteFiche={peutEnvoyerCetteFiche}
                peutSupprimer={peutSupprimer}
                afficheBarreActions={afficheBarreActions}
                onTelecharger={() => void handleTelecharger()}
                onDemanderEnvoi={() => setConfirmationEnvoi(true)}
                onDemanderSuppression={() => setConfirmationSuppression(true)}
              />
            </div>

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
            />
          </div>
        </CardContent>
      </Card>

      <FamilleDialog
        familleDialog={familleDialog}
        onFermer={() => setFamilleDialog(null)}
        sectionDialog={sectionDialog}
        lignesSystacDialog={lignesSystacDialog}
        detail={detail}
        totauxSystacCorrespondent={totauxSystacCorrespondent}
        peutGererLignes={peutGererLignes}
        dialogEnfantOuvert={dialogEnfantOuvert}
        onAjouterLigne={() =>
          (familleDialog === "numeraire" || familleDialog === "sigma") &&
          setLigneFormulaire({ mode: "creation", famille: familleDialog })
        }
        onModifierLigne={(ligne) =>
          (familleDialog === "numeraire" || familleDialog === "sigma") &&
          setLigneFormulaire({ mode: "edition", famille: familleDialog, ligne })
        }
        onSupprimerLigne={(ligne) =>
          (familleDialog === "numeraire" || familleDialog === "sigma") &&
          setLigneASupprimer({ famille: familleDialog, ligne })
        }
      />

      <LigneFormulaireDialog
        key={
          ligneFormulaire
            ? `${ligneFormulaire.famille}-${ligneFormulaire.mode}-${ligneFormulaire.ligne?.id ?? "nouvelle"}`
            : "vide"
        }
        ouvert={ligneFormulaire !== null}
        famille={ligneFormulaire?.famille ?? null}
        ligne={ligneFormulaire?.ligne}
        reference={reference}
        lignesFrere={
          ligneFormulaire
            ? (ligneFormulaire.famille === "sigma"
                ? (detail?.mouvements_sygma ?? [])
                : (detail?.mouvements_numeraire ?? [])
              ).filter((l) => l.id !== ligneFormulaire.ligne?.id)
            : []
        }
        onFermer={() => setLigneFormulaire(null)}
        onEnregistre={rechargerDetail}
      />

      <ConfirmerSuppressionLigneDialog
        ligne={ligneASupprimer}
        suppressionEnCours={suppressionLigneEnCours}
        onOpenChange={(open) => !open && setLigneASupprimer(null)}
        onConfirmer={() => void confirmerSuppressionLigne()}
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
    </div>
  );
}

import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { History, Inbox, Loader2 } from "lucide-react";
import { getPortalMenu } from "@/shared/config/menu";
import { TooltipProvider } from "@/shared/components/ui/tooltip";
import { libelleDateFr } from "@/portails/Sp/components/fiche-bleue/fiche-bleue-affichage";
import { ChronologieFichesDepot } from "@/portails/Sp/components/fiche-depot/ChronologieFichesDepot";
import { SyntheseDepotsJournee } from "@/portails/Sp/components/fiche-depot/SyntheseDepotsJournee";
import { TableauFicheDepotExcel } from "@/portails/Sp/components/fiche-depot/TableauFicheDepotExcel";
import { ContenuDetailFicheDepot } from "@/portails/Sp/components/fiche-matinale/PreviewFicheDepotDialog";
import {
  BoutonPleinEcran, OverlayPleinEcran,
} from "@/portails/Sp/components/plein-ecran/PleinEcran";
import { detailFicheDepot } from "@/portails/Sp/api/fiches-depot";
import { useDepensesJournee } from "@/portails/Sp/hooks/use-depenses-journee";
import { useJourneeSelectionnee } from "@/portails/Sp/hooks/journee-selectionnee";
import { useFichesDepotJournee } from "@/portails/Sp/hooks/use-fiches-depot-journee";
import type { FicheDepotDetailSp } from "@/portails/Sp/types/fiche-depot.interface";

/**
 * Fiches de dépôt de la journée choisie dans la TopBar. Le Service Règlement
 * envoie souvent plusieurs fiches complémentaires : la page les présente en
 * chronologie (apport de chacune), avec la fiche sélectionnée en détail et
 * l'état de la liste des dépenses validée pour le rapprochement.
 */
export default function FicheDepots() {
  const navigate = useNavigate();
  const theme = getPortalMenu("sp").theme;
  const [searchParams, setSearchParams] = useSearchParams();
  const { journee, date } = useJourneeSelectionnee();
  const { fiches, chargement, erreur } = useFichesDepotJournee();
  const referenceJournee = journee?.reference ?? null;
  const { etat, chargement: chargementEtat, validation, valider } = useDepensesJournee(
    referenceJournee,
    fiches.length,
  );
  const dateLibelle = libelleDateFr(date);

  const demandee = searchParams.get("fiche");
  const selection = fiches.find((f) => f.reference === demandee)?.reference
    ?? fiches[0]?.reference
    ?? null;
  const indexSelection = fiches.findIndex((f) => f.reference === selection);

  function selectionner(reference: string) {
    setSearchParams(reference === fiches[0]?.reference ? {} : { fiche: reference }, { replace: true });
  }

  function ouvrirRapprochement() {
    if (!referenceJournee) return;
    void navigate(`/sp/fiche-matinale/rapprochement-depenses/${encodeURIComponent(referenceJournee)}`);
  }

  // Plein écran : détail Excel de la fiche sélectionnée, chargé à la demande.
  const [pleinEcran, setPleinEcran] = useState(false);
  const [excel, setExcel] = useState<{ reference: string; detail: FicheDepotDetailSp | null } | null>(null);
  const referenceExcel = pleinEcran ? selection : null;
  const detailExcel = excel && excel.reference === referenceExcel ? excel.detail : null;
  const chargementExcel = referenceExcel !== null && excel?.reference !== referenceExcel;

  useEffect(() => {
    if (!referenceExcel) return;
    let annule = false;
    void detailFicheDepot(referenceExcel)
      .then((d) => {
        if (!annule) setExcel({ reference: referenceExcel, detail: d });
      })
      .catch(() => {
        if (!annule) setExcel({ reference: referenceExcel, detail: null });
      });
    return () => {
      annule = true;
    };
  }, [referenceExcel]);

  return (
    <TooltipProvider>
      <div className="flex flex-col gap-4 md:min-h-0 md:flex-1">
        <div className="flex shrink-0 flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
          <h2 className="text-[14px] font-semibold text-foreground sm:text-[15px]">
            Journée du {dateLibelle}
          </h2>
          {referenceJournee ? (
            <span className="font-mono text-[12px] text-muted-foreground">{referenceJournee}</span>
          ) : null}
        </div>

        <div className="shrink-0">
          <SyntheseDepotsJournee
            fiches={fiches}
            etat={etat}
            chargementEtat={chargementEtat}
            avecJournee={referenceJournee !== null}
            lectureSeule={journee?.etat === "cloture"}
            validation={validation}
            onValider={() => {
              void valider();
            }}
            onRapprochement={ouvrirRapprochement}
          />
        </div>

        {chargement ? (
          <div className="flex min-h-[240px] flex-1 items-center justify-center text-muted-foreground">
            <Loader2 className="size-6 animate-spin" />
          </div>
        ) : fiches.length === 0 ? (
          <div className="flex min-h-[260px] flex-1 flex-col items-center justify-center gap-4 rounded-2xl border border-dashed px-4 text-center">
            <div
              className="flex size-12 items-center justify-center rounded-2xl"
              style={{ background: theme.iconBg, color: theme.iconColor }}
            >
              <Inbox className="size-6" />
            </div>
            <div className="max-w-md space-y-1.5">
              <p className="text-[15px] font-semibold text-foreground">
                {erreur ? "Erreur de chargement" : "Aucune fiche de dépôt"}
              </p>
              <p className="text-[13px] leading-relaxed text-muted-foreground">
                {erreur
                  ? "Les fiches de dépôt n'ont pas pu être chargées. Veuillez rafraîchir la page."
                  : `Aucune fiche reçue du Service Règlement pour la journée du ${dateLibelle}.`}
              </p>
            </div>
          </div>
        ) : (
          <div className="grid gap-4 md:min-h-0 md:flex-1 md:grid-cols-[17rem_minmax(0,1fr)] lg:grid-cols-[19rem_minmax(0,1fr)]">
            <aside
              className="flex flex-col overflow-hidden rounded-2xl border bg-muted/20 md:min-h-0"
              style={{ borderColor: `${theme.topColor}28` }}
            >
              <div className="flex shrink-0 items-center justify-between gap-2 border-b px-4 py-3">
                <p className="flex items-center gap-1.5 text-[13px] font-semibold text-foreground">
                  <History className="size-3.5" style={{ color: theme.iconColor }} />
                  Chronologie
                </p>
                <span className="text-[11px] text-muted-foreground">
                  {fiches.length} fiche{fiches.length > 1 ? "s" : ""}
                </span>
              </div>
              <div className="max-h-80 overflow-y-auto md:max-h-none md:min-h-0 md:flex-1">
                <ChronologieFichesDepot
                  fiches={fiches}
                  etat={etat}
                  selection={selection}
                  onSelection={selectionner}
                />
              </div>
            </aside>

            <section
              className="flex flex-col overflow-hidden rounded-2xl border bg-card md:min-h-0"
              style={{ borderColor: `${theme.topColor}28` }}
            >
              <div className="flex shrink-0 items-center justify-between gap-2 border-b px-4 py-3 sm:px-5">
                <p className="text-[13px] font-semibold text-foreground">
                  Détail de la fiche
                  {fiches.length > 1 ? (
                    <span className="ml-1.5 font-normal text-muted-foreground">
                      · {fiches.length - indexSelection} sur {fiches.length}
                    </span>
                  ) : null}
                </p>
                <BoutonPleinEcran
                  actif={pleinEcran}
                  onToggle={() => setPleinEcran((v) => !v)}
                  libelleEnter="Afficher la Fiche de dépôt en plein écran"
                />
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-5">
                {selection ? <ContenuDetailFicheDepot reference={selection} /> : null}
              </div>
            </section>
          </div>
        )}
      </div>

      <OverlayPleinEcran
        ouvert={pleinEcran && selection !== null}
        titre="Fiche de dépôt"
        sousTitre={selection ?? undefined}
        onClose={() => setPleinEcran(false)}
        ariaLabel="Fiche de dépôt en plein écran"
      >
        <TableauFicheDepotExcel fiche={detailExcel} chargement={chargementExcel} />
      </OverlayPleinEcran>
    </TooltipProvider>
  );
}

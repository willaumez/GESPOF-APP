import { useEffect, useState } from "react";
import { Link2, Loader2, Plus, Trash2 } from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import { BoutonAcces } from "@/shared/components/ui/bouton-acces";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/shared/components/ui/dialog";
import { cn } from "@/shared/lib/utils";
import { formatMontant } from "@/shared/lib/format";
import {
  BoutonPleinEcran,
  OverlayPleinEcran,
} from "@/portails/Sp/components/plein-ecran/PleinEcran";
import type {
  DonneesMouvement,
  FicheDepotDetail,
  LigneMouvement,
  LigneSystacDetail,
} from "@/portails/Sr/types";
import { SYSTAC_COL_WIDTHS, TYPE_CFG, type SectionMouvement, type TypeMouvement } from "./constants";
import { TableSystac } from "./TableSystac";
import { TableMouvementsFamille } from "./TableMouvementsFamille";

interface FamilleDialogProps {
  familleDialog: TypeMouvement | null;
  onFermer: () => void;
  sectionDialog: SectionMouvement | undefined;
  lignesSystacDialog: LigneSystacDetail[];
  detail: FicheDepotDetail | null;
  totauxSystacCorrespondent: boolean;
  peutGererLignes: boolean;
  dialogEnfantOuvert: boolean;
  idsSystacSelection: number[];
  onIdsSystacSelection: (ids: number[]) => void;
  idsMouvementSelection: number[];
  onIdsMouvementSelection: (ids: number[]) => void;
  onAjouterLigne: () => void;
  onModifierMouvement: (ligne: LigneMouvement, donnees: DonneesMouvement) => void;
  onSupprimerSelection: () => void;
  onRegrouperSystac: () => void;
  onRegrouperMouvements: () => void;
  ajoutEnCours?: boolean;
  regroupementEnCours?: boolean;
  suppressionEnCours?: boolean;
  onModifierLigneSystac: (
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
  ) => void;
}

function PiedSystac({
  detail,
  totauxSystacCorrespondent,
  onFermer,
  afficherFermer,
}: {
  detail: FicheDepotDetail | null;
  totauxSystacCorrespondent: boolean;
  onFermer: () => void;
  afficherFermer: boolean;
}) {
  return (
    <div className={cn("relative shrink-0 bg-muted", afficherFermer && "rounded-b-lg")}>
      <div className="overflow-y-auto [scrollbar-gutter:stable]">
        <table className="w-full table-fixed">
          <colgroup>
            {SYSTAC_COL_WIDTHS.map((largeur, i) => (
              <col key={i} style={{ width: largeur }} />
            ))}
          </colgroup>
          <tbody>
            <tr>
              <td />
              <td />
              <td />
              <td />
              <td />
              <td
                className={cn(
                  "pr-2 text-right align-middle",
                  totauxSystacCorrespondent ? "bg-[#2a7f62]/10" : "bg-destructive/10",
                )}
              >
                <p
                  className={cn(
                    "text-sm font-bold tabular-nums",
                    totauxSystacCorrespondent ? "text-[#2a7f62]" : "text-destructive",
                  )}
                >
                  {formatMontant(detail?.total_systac ?? "0")}
                </p>
              </td>
              <td
                className={cn(
                  "pr-2 text-right align-middle",
                  totauxSystacCorrespondent ? "bg-[#2a7f62]/10" : "bg-destructive/10",
                )}
              >
                <p
                  className={cn(
                    "text-sm font-bold tabular-nums",
                    totauxSystacCorrespondent ? "text-[#2a7f62]" : "text-destructive",
                  )}
                >
                  {formatMontant(detail?.total_groupe ?? "0")}
                </p>
              </td>
              <td />
              <td />
            </tr>
          </tbody>
        </table>
      </div>
      {afficherFermer ? (
        <Button
          variant="outline"
          onClick={onFermer}
          className="absolute top-1/2 right-4 -translate-y-1/2"
        >
          Fermer
        </Button>
      ) : null}
    </div>
  );
}

export function FamilleDialog({
  familleDialog,
  onFermer,
  sectionDialog,
  lignesSystacDialog,
  detail,
  totauxSystacCorrespondent,
  peutGererLignes,
  dialogEnfantOuvert,
  idsSystacSelection,
  onIdsSystacSelection,
  idsMouvementSelection,
  onIdsMouvementSelection,
  onAjouterLigne,
  onModifierMouvement,
  onSupprimerSelection,
  onRegrouperSystac,
  onRegrouperMouvements,
  ajoutEnCours = false,
  regroupementEnCours = false,
  suppressionEnCours = false,
  onModifierLigneSystac,
}: FamilleDialogProps) {
  const [pleinEcran, setPleinEcran] = useState(false);
  const cfgDialog = familleDialog ? TYPE_CFG[familleDialog] : null;
  const estSystac = familleDialog === "systac";
  const estMouvement = familleDialog === "numeraire" || familleDialog === "sigma";
  const lignesDialog = estSystac ? lignesSystacDialog : (sectionDialog?.lignes ?? []);
  const titre = `Règlements ${cfgDialog?.label.toLowerCase() ?? ""}`;
  const sousTitre = `${lignesDialog.length} ligne${lignesDialog.length > 1 ? "s" : ""}`;
  const actionBloquee = ajoutEnCours || regroupementEnCours || suppressionEnCours;

  useEffect(() => {
    if (familleDialog === null) setPleinEcran(false);
  }, [familleDialog]);

  function fermer() {
    setPleinEcran(false);
    onFermer();
  }

  const actionsGestion = peutGererLignes ? (
    <>
      {estSystac ? (
        <>
          <BoutonAcces
            acces="GERER_MOUVEMENT_FICHE"
            type="button"
            size="sm"
            variant="outline"
            disabled={actionBloquee}
            className="gap-1.5 border-[#064A85] text-[#064A85] hover:bg-[#064A85]/10"
            onClick={onAjouterLigne}
          >
            {ajoutEnCours ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Plus className="size-4" />
            )}
            {ajoutEnCours ? "Ajout…" : "Ajouter"}
          </BoutonAcces>
          <BoutonAcces
            acces="GERER_MOUVEMENT_FICHE"
            type="button"
            size="sm"
            variant="outline"
            disabled={actionBloquee || idsSystacSelection.length < 1}
            className="gap-1.5 border-destructive/40 text-destructive hover:bg-destructive/10"
            onClick={onSupprimerSelection}
          >
            {suppressionEnCours ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Trash2 className="size-4" />
            )}
            {suppressionEnCours
              ? "Suppression…"
              : `Supprimer${idsSystacSelection.length > 0 ? ` (${idsSystacSelection.length})` : ""}`}
          </BoutonAcces>
          <BoutonAcces
            acces="GERER_MOUVEMENT_FICHE"
            type="button"
            size="sm"
            variant="outline"
            disabled={actionBloquee || idsSystacSelection.length < 2}
            className="gap-1.5 border-[#064A85] text-[#064A85] hover:bg-[#064A85]/10"
            onClick={onRegrouperSystac}
          >
            {regroupementEnCours ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Link2 className="size-4" />
            )}
            {regroupementEnCours
              ? "Regroupement…"
              : `Regrouper la sélection (${idsSystacSelection.length})`}
          </BoutonAcces>
        </>
      ) : estMouvement ? (
        <>
          <BoutonAcces
            acces="GERER_MOUVEMENT_FICHE"
            type="button"
            size="sm"
            variant="outline"
            disabled={actionBloquee}
            className="gap-1.5 border-[#064A85] text-[#064A85] hover:bg-[#064A85]/10"
            onClick={onAjouterLigne}
          >
            {ajoutEnCours ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Plus className="size-4" />
            )}
            {ajoutEnCours ? "Ajout…" : "Ajouter"}
          </BoutonAcces>
          <BoutonAcces
            acces="GERER_MOUVEMENT_FICHE"
            type="button"
            size="sm"
            variant="outline"
            disabled={actionBloquee || idsMouvementSelection.length < 1}
            className="gap-1.5 border-destructive/40 text-destructive hover:bg-destructive/10"
            onClick={onSupprimerSelection}
          >
            {suppressionEnCours ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Trash2 className="size-4" />
            )}
            {suppressionEnCours
              ? "Suppression…"
              : `Supprimer${idsMouvementSelection.length > 0 ? ` (${idsMouvementSelection.length})` : ""}`}
          </BoutonAcces>
          <BoutonAcces
            acces="GERER_MOUVEMENT_FICHE"
            type="button"
            size="sm"
            variant="outline"
            disabled={actionBloquee || idsMouvementSelection.length < 2}
            className="gap-1.5 border-[#064A85] text-[#064A85] hover:bg-[#064A85]/10"
            onClick={onRegrouperMouvements}
          >
            {regroupementEnCours ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Link2 className="size-4" />
            )}
            {regroupementEnCours
              ? "Regroupement…"
              : `Regrouper la sélection (${idsMouvementSelection.length})`}
          </BoutonAcces>
        </>
      ) : null}
    </>
  ) : null;

  const tableau = estSystac ? (
    <TableSystac
      lignes={lignesSystacDialog}
      peutGererLignes={peutGererLignes}
      idsSelection={idsSystacSelection}
      onSelectionChange={onIdsSystacSelection}
      onModifierLigne={onModifierLigneSystac}
    />
  ) : (
    <TableMouvementsFamille
      lignes={sectionDialog?.lignes ?? []}
      peutGererLignes={peutGererLignes}
      idsSelection={idsMouvementSelection}
      onSelectionChange={onIdsMouvementSelection}
      onModifierLigne={onModifierMouvement}
    />
  );

  return (
    <Dialog
      open={familleDialog !== null}
      // En plein écran, désactiver le mode modal pour laisser la molette
      // atteindre l'overlay (sinon RemoveScroll du Dialog la bloque).
      modal={!pleinEcran}
      onOpenChange={(open) => {
        if (open || dialogEnfantOuvert) return;
        fermer();
      }}
    >
      <DialogContent
        className={cn(
          "flex max-h-[calc(100dvh-2rem)] w-full max-w-[98vw] flex-col overflow-hidden",
          estSystac ? "sm:max-w-[96rem]" : "sm:max-w-7xl",
        )}
        onEscapeKeyDown={(e) => {
          if (pleinEcran) {
            e.preventDefault();
            setPleinEcran(false);
            return;
          }
          e.preventDefault();
        }}
        onPointerDownOutside={(e) => e.preventDefault()}
        onInteractOutside={(e) => e.preventDefault()}
      >
        <DialogHeader className="shrink-0 pr-8">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0 space-y-1.5">
              <DialogTitle>{titre}</DialogTitle>
              <DialogDescription>
                {sousTitre}
                {peutGererLignes
                  ? estSystac
                    ? " — cochez plusieurs lignes pour les regrouper, double-cliquez une cellule pour la modifier."
                    : " — double-cliquez une cellule pour la modifier, cochez plusieurs lignes pour les regrouper."
                  : ""}
              </DialogDescription>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              {actionsGestion}
              <BoutonPleinEcran
                actif={pleinEcran}
                onToggle={() => setPleinEcran((v) => !v)}
                libelleEnter={`Afficher ${titre.toLowerCase()} en plein écran`}
              />
            </div>
          </div>
        </DialogHeader>

        <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border">
          {pleinEcran ? (
            <div className="flex min-h-[120px] flex-1 items-center justify-center text-[13px] text-muted-foreground">
              Tableau affiché en plein écran
            </div>
          ) : (
            tableau
          )}
        </div>

        <DialogFooter className={cn("shrink-0", estSystac && "relative bg-muted p-0 sm:flex-col")}>
          {estSystac ? (
            <PiedSystac
              detail={detail}
              totauxSystacCorrespondent={totauxSystacCorrespondent}
              onFermer={fermer}
              afficherFermer
            />
          ) : (
            <>
              <div className="mr-auto text-sm font-semibold tabular-nums text-foreground">
                Total : {formatMontant(sectionDialog?.total ?? "0")} FCFA
              </div>
              <Button variant="outline" onClick={fermer}>
                Fermer
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>

      <OverlayPleinEcran
        ouvert={pleinEcran && familleDialog !== null}
        portail="sr"
        titre={titre}
        sousTitre={sousTitre}
        onClose={() => setPleinEcran(false)}
        ariaLabel={`${titre} en plein écran`}
        actions={actionsGestion}
      >
        <div className="flex h-full min-h-0 flex-col overflow-hidden overscroll-contain rounded-lg border bg-card">
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden">{tableau}</div>
          {estSystac ? (
            <PiedSystac
              detail={detail}
              totauxSystacCorrespondent={totauxSystacCorrespondent}
              onFermer={() => setPleinEcran(false)}
              afficherFermer={false}
            />
          ) : (
            <div className="shrink-0 border-t px-4 py-3 text-sm font-semibold tabular-nums">
              Total : {formatMontant(sectionDialog?.total ?? "0")} FCFA
            </div>
          )}
        </div>
      </OverlayPleinEcran>
    </Dialog>
  );
}

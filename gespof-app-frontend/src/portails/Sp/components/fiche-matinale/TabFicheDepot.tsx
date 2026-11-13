import { useCallback, useEffect, useState } from "react";
import { Bell, Check, CreditCard, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { getPortalMenu } from "@/shared/config/menu";
import { messageDonneesOuDefaut } from "@/shared/lib/message-utilisateur";
import { formatMontant } from "@/shared/lib/format";
import { Button } from "@/shared/components/ui/button";
import { ContenuDetailFicheDepot } from "@/portails/Sp/components/fiche-matinale/PreviewFicheDepotDialog";
import { TableauFicheDepotExcel } from "@/portails/Sp/components/fiche-depot/TableauFicheDepotExcel";
import { OverlayPleinEcran } from "@/portails/Sp/components/plein-ecran/PleinEcran";
import { detailFicheDepot, listerFichesDepotDeJournee } from "@/portails/Sp/api/fiches-depot";
import { demanderFicheDepotJournee } from "@/portails/Sp/api/journees-tresorerie";
import type {
  FicheDepotDetailSp, FicheDepotResumeSp,
} from "@/portails/Sp/types/fiche-depot.interface";
import type { JourneeTresorerie } from "@/portails/Sp/types/journee-tresorerie.interface";

function formaterHeureReception(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return `Reçue à ${date.toLocaleTimeString("fr-FR", {
    hour: "2-digit",
    minute: "2-digit",
  })}`;
}

function sourceDepuisReference(ref: string): string {
  const u = ref.toUpperCase();
  if (u.includes("SYSTAC") || u.includes("SYS")) return "Systac";
  if (u.includes("SIGMA") || u.includes("SIG")) return "Sigma";
  if (u.includes("NUM")) return "Numéraire";
  return "Fiche de dépôt";
}

/** Plus récente d'abord (date d'envoi). */
function trierParRecence(fiches: FicheDepotResumeSp[]): FicheDepotResumeSp[] {
  return [...fiches].sort(
    (a, b) => new Date(b.date_creation).getTime() - new Date(a.date_creation).getTime(),
  );
}

interface TabFicheDepotProps {
  journee: JourneeTresorerie;
  actif: boolean;
  onNombreFichesChange?: (nombre: number) => void;
}

/**
 * Onglet Fiche de dépôt — cartes maquette Prototype v2.
 */
export function TabFicheDepot({
  journee,
  actif,
  onNombreFichesChange,
}: TabFicheDepotProps) {
  const theme = getPortalMenu("sp").theme;

  const [chargement, setChargement] = useState(false);
  const [fiches, setFiches] = useState<FicheDepotResumeSp[]>([]);
  const [detailRef, setDetailRef] = useState<string | null>(null);
  const [pleinEcranRef, setPleinEcranRef] = useState<string | null>(null);
  const [detailExcel, setDetailExcel] = useState<FicheDepotDetailSp | null>(null);
  const [erreurExcel, setErreurExcel] = useState<string | null>(null);
  const [demandeEnCours, setDemandeEnCours] = useState(false);
  const [demandeEnvoyee, setDemandeEnvoyee] = useState(false);

  const fermerPleinEcran = useCallback(() => {
    setPleinEcranRef(null);
    setErreurExcel(null);
  }, []);

  useEffect(() => {
    if (!pleinEcranRef) return;
    let annule = false;
    void detailFicheDepot(pleinEcranRef)
      .then((d) => {
        if (!annule) setDetailExcel(d);
      })
      .catch((e) => {
        if (!annule) {
          setErreurExcel(pleinEcranRef);
          toast.error(
            messageDonneesOuDefaut(
              e instanceof Error ? e.message : null,
              "Impossible de charger la Fiche de dépôt.",
            ),
          );
        }
      });
    return () => {
      annule = true;
    };
  }, [pleinEcranRef]);

  const ficheExcel = detailExcel?.reference === pleinEcranRef ? detailExcel : null;
  const chargementExcel =
    pleinEcranRef !== null && ficheExcel === null && erreurExcel !== pleinEcranRef;

  const cloturee = journee.etat === "cloture";

  async function prevenirServiceReglement() {
    if (demandeEnCours || demandeEnvoyee || cloturee) return;
    setDemandeEnCours(true);
    try {
      const { deja_envoyee } = await demanderFicheDepotJournee(journee.reference);
      setDemandeEnvoyee(true);
      toast.success(
        deja_envoyee
          ? "Le Service Règlement a déjà été prévenu pour cette journée."
          : "Le Service Règlement a été prévenu : fiche de dépôt attendue.",
      );
    } catch (e) {
      toast.error(
        messageDonneesOuDefaut(
          e instanceof Error ? e.message : null,
          "Impossible d'envoyer la demande au Service Règlement.",
        ),
      );
    } finally {
      setDemandeEnCours(false);
    }
  }

  useEffect(() => {
    if (!actif) return;
    let annule = false;
    setChargement(true);
    void listerFichesDepotDeJournee(journee.reference)
      .then((page) => {
        if (!annule) {
          const liste = trierParRecence(page.fiches ?? []);
          setFiches(liste);
          onNombreFichesChange?.(liste.length);
        }
      })
      .catch((e) => {
        if (!annule) {
          setFiches([]);
          onNombreFichesChange?.(0);
          toast.error(
            messageDonneesOuDefaut(
              e instanceof Error ? e.message : null,
              "Impossible de charger les Fiches de dépôt de la journée.",
            ),
          );
        }
      })
      .finally(() => {
        if (!annule) setChargement(false);
      });
    return () => {
      annule = true;
    };
  }, [actif, journee.reference, onNombreFichesChange]);

  useEffect(() => {
    setDemandeEnvoyee(false);
  }, [journee.reference]);

  if (chargement) {
    return (
      <div className="flex min-h-[180px] items-center justify-center text-[#64748b]">
        <Loader2 className="size-6 animate-spin" />
      </div>
    );
  }

  if (fiches.length === 0) {
    return (
      <div className="flex min-h-[200px] flex-col items-center justify-center gap-3 rounded-lg border border-[#e2e8f0] bg-white px-4 text-center">
        <div
          className="flex size-12 items-center justify-center rounded-lg"
          style={{ background: theme.iconBg, color: theme.iconColor }}
        >
          <CreditCard className="size-6" />
        </div>
        <div className="max-w-md space-y-1">
          <p className="text-[15px] font-semibold text-[#0f172a]">
            Aucune Fiche de dépôt liée à cette journée
          </p>
          <p className="text-[13px] leading-relaxed text-[#64748b]">
            Seules les fiches envoyées par le Service Règlement et rattachées à{" "}
            {journee.reference} apparaissent ici. Cette étape est optionnelle.
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="mt-1 gap-1.5"
          disabled={demandeEnCours || demandeEnvoyee || cloturee}
          onClick={() => void prevenirServiceReglement()}
        >
          {demandeEnCours ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : demandeEnvoyee ? (
            <Check className="size-3.5" />
          ) : (
            <Bell className="size-3.5" />
          )}
          {demandeEnvoyee
            ? "Service Règlement prévenu"
            : "Prévenir le Service Règlement"}
        </Button>
      </div>
    );
  }

  return (
    <>
      <div
        className="grid"
        style={{
          gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
          gap: 16,
        }}
      >
        {fiches.map((fiche) => (
          <button
            key={fiche.reference}
            type="button"
            onClick={() => setDetailRef(fiche.reference)}
            className="flex flex-col rounded-lg border border-[#e2e8f0] bg-white text-left"
            style={{
              gap: 14,
              padding: 18,
              borderTop: "3px solid #0760A8",
            }}
          >
            <div className="flex items-start justify-between gap-2">
              <span className="flex flex-col" style={{ gap: 2 }}>
                <span className="text-base font-semibold text-[#0f172a]">
                  {sourceDepuisReference(fiche.reference)}
                </span>
                <span className="text-[13px] text-[#64748b]">
                  {fiche.genere_par ? `Par ${fiche.genere_par}` : "Reçue du Service Règlement"}
                </span>
              </span>
              <span
                className="shrink-0 whitespace-nowrap"
                style={{
                  fontSize: 12,
                  fontWeight: 500,
                  padding: "2px 9px",
                  borderRadius: 4,
                  background: "#fffbeb",
                  color: "#b45309",
                }}
              >
                Reçue SP
              </span>
            </div>
            <div className="flex items-baseline gap-1.5">
              <span className="text-[22px] font-semibold tabular-nums text-[#0f172a]">
                {formatMontant(fiche.montant_total)}
              </span>
              <span className="text-xs font-semibold text-[#64748b]">FCFA</span>
            </div>
            <div className="flex items-center justify-between border-t border-[#f1f5f9] pt-3 text-[12.5px] text-[#64748b]">
              <span
                style={{
                  fontFamily: '"IBM Plex Mono", ui-monospace, monospace',
                  color: "#064A85",
                }}
              >
                {fiche.reference}
              </span>
              <span>{formaterHeureReception(fiche.date_creation)}</span>
            </div>
          </button>
        ))}
      </div>

      {detailRef ? (
        <div className="mt-4 overflow-hidden rounded-lg border border-[#e2e8f0] bg-white p-4">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <span
              className="text-[13px] font-medium"
              style={{
                fontFamily: '"IBM Plex Mono", ui-monospace, monospace',
                color: "#064A85",
              }}
            >
              {detailRef}
            </span>
            <div className="flex gap-2">
              <button
                type="button"
                className="h-8 rounded-md border border-[#e2e8f0] bg-white px-3 text-[13px] hover:border-[#94a3b8]"
                onClick={() => setPleinEcranRef(detailRef)}
              >
                Plein écran
              </button>
              <button
                type="button"
                className="h-8 rounded-md border border-[#e2e8f0] bg-white px-3 text-[13px] hover:border-[#94a3b8]"
                onClick={() => setDetailRef(null)}
              >
                Fermer
              </button>
            </div>
          </div>
          <ContenuDetailFicheDepot
            reference={detailRef}
            referenceJournee={journee.reference}
          />
        </div>
      ) : null}

      <OverlayPleinEcran
        ouvert={pleinEcranRef !== null}
        titre="Fiche de dépôt"
        sousTitre={pleinEcranRef ?? undefined}
        onClose={fermerPleinEcran}
        ariaLabel="Fiche de dépôt en plein écran"
      >
        <TableauFicheDepotExcel fiche={ficheExcel} chargement={chargementExcel} />
      </OverlayPleinEcran>
    </>
  );
}

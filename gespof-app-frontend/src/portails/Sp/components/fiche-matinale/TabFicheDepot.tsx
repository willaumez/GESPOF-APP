import { useCallback, useEffect, useState } from "react";
import { Bell, Check, CreditCard, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { getPortalMenu } from "@/shared/config/menu";
import { messageDonneesOuDefaut } from "@/shared/lib/message-utilisateur";
import { formatMontant } from "@/shared/lib/format";
import { cn } from "@/shared/lib/utils";
import { Badge } from "@/shared/components/ui/badge";
import { Button } from "@/shared/components/ui/button";
import { ContenuDetailFicheDepot } from "@/portails/Sp/components/fiche-matinale/PreviewFicheDepotDialog";
import { TableauFicheDepotExcel } from "@/portails/Sp/components/fiche-depot/TableauFicheDepotExcel";
import {
  BoutonPleinEcran, OverlayPleinEcran,
} from "@/portails/Sp/components/plein-ecran/PleinEcran";
import { detailFicheDepot, listerFichesDepotDeJournee } from "@/portails/Sp/api/fiches-depot";
import { demanderFicheDepotJournee } from "@/portails/Sp/api/journees-tresorerie";
import type {
  FicheDepotDetailSp, FicheDepotResumeSp,
} from "@/portails/Sp/types/fiche-depot.interface";
import type { JourneeTresorerie } from "@/portails/Sp/types/journee-tresorerie.interface";

function formaterMontant(valeur: string): string {
  return formatMontant(valeur);
}

function formaterDateHeure(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Plus récente d'abord (date d'envoi), quel que soit l'ordre renvoyé par l'API. */
function trierParRecence(fiches: FicheDepotResumeSp[]): FicheDepotResumeSp[] {
  return [...fiches].sort(
    (a, b) => new Date(b.date_creation).getTime() - new Date(a.date_creation).getTime(),
  );
}

function libelleStatutDepot(statut: string): string {
  if (statut === "envoyee") return "Envoyée";
  if (statut === "recue") return "Reçue";
  if (statut === "cree") return "Créée";
  return statut.replace("_", " ");
}

interface TabFicheDepotProps {
  journee: JourneeTresorerie;
  actif: boolean;
  onNombreFichesChange?: (nombre: number) => void;
}

/**
 * Onglet Fiche de dépôt : fiches envoyées par le SR et rattachées
 * à la journée de trésorerie (via la Fiche Bleue du jour).
 * Liste verticale des fiches à gauche (plus récente en tête, affichée par défaut),
 * contenu de la fiche sélectionnée à droite.
 */
export function TabFicheDepot({
  journee,
  actif,
  onNombreFichesChange,
}: TabFicheDepotProps) {
  const theme = getPortalMenu("sp").theme;

  const [chargement, setChargement] = useState(false);
  const [fiches, setFiches] = useState<FicheDepotResumeSp[]>([]);
  /** Fiche affichée en plein écran (vue tableur), null = fermé. */
  const [pleinEcranRef, setPleinEcranRef] = useState<string | null>(null);
  const [detailExcel, setDetailExcel] = useState<FicheDepotDetailSp | null>(null);
  /** Référence dont le chargement plein écran a échoué (arrête le spinner). */
  const [erreurExcel, setErreurExcel] = useState<string | null>(null);
  /** Fiche choisie dans le sélecteur ; null → la plus récente. */
  const [selection, setSelection] = useState<string | null>(null);
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

  // Détail déjà chargé pour une autre fiche : ignoré tant que le bon n'est pas arrivé.
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
          setSelection(null);
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
      <div className="flex min-h-[180px] items-center justify-center text-muted-foreground">
        <Loader2 className="size-6 animate-spin" />
      </div>
    );
  }

  if (fiches.length === 0) {
    return (
      <div className="flex min-h-[200px] flex-col items-center justify-center gap-3 px-4 text-center">
        <div
          className="flex size-12 items-center justify-center rounded-2xl"
          style={{ background: theme.iconBg, color: theme.iconColor }}
        >
          <CreditCard className="size-6" />
        </div>
        <div className="max-w-md space-y-1">
          <p className="text-[15px] font-semibold text-foreground">
            Aucune Fiche de dépôt liée à cette journée
          </p>
          <p className="text-[13px] leading-relaxed text-muted-foreground">
            Seules les fiches de dépôt envoyées par le Service Règlement et
            rattachées à la journée {journee.reference} apparaissent ici.
            Cette étape est optionnelle.
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="mt-1 gap-1.5"
          disabled={demandeEnCours || demandeEnvoyee || cloturee}
          title={cloturee ? "Journée clôturée : demande impossible" : undefined}
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

  const ficheAffichee =
    fiches.find((f) => f.reference === selection) ?? fiches[0];

  return (
    <div className="flex flex-col gap-4 @2xl:flex-row @2xl:items-start">
      {/* Liste verticale des fiches du jour (plus récente en tête) */}
      <aside className="flex shrink-0 flex-col overflow-hidden rounded-xl border bg-muted/30 @2xl:w-64">
        <div className="flex items-center justify-between gap-2 border-b px-3 py-2.5">
          <p className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
            Fiches du jour
          </p>
          <span className="text-[11px] font-medium text-muted-foreground tabular-nums">
            {fiches.length}
          </span>
        </div>
        <ul
          className="flex max-h-60 flex-col gap-1 overflow-y-auto p-2 @2xl:max-h-[32rem]"
          aria-label="Fiches de dépôt de la journée"
        >
          {fiches.map((fiche, index) => {
            const affichee = fiche.reference === ficheAffichee.reference;
            return (
              <li key={fiche.reference}>
                <button
                  type="button"
                  aria-current={affichee ? "true" : undefined}
                  onClick={() => setSelection(fiche.reference)}
                  className={cn(
                    "relative flex w-full flex-col gap-0.5 overflow-hidden rounded-lg border px-3 py-2 text-left transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/40",
                    affichee
                      ? "border-primary/50 bg-card shadow-sm"
                      : "border-transparent hover:bg-card/80",
                  )}
                >
                  {affichee ? (
                    <span className="absolute inset-y-0 left-0 w-0.5 bg-primary" aria-hidden />
                  ) : null}
                  <span className="flex items-center justify-between gap-2">
                    <span className="truncate text-[12.5px] font-semibold tabular-nums text-foreground">
                      {fiche.reference}
                    </span>
                    {index === 0 ? (
                      <Badge className="shrink-0 border-transparent bg-primary/10 px-1.5 text-[9.5px] text-primary">
                        Récente
                      </Badge>
                    ) : null}
                  </span>
                  <span className="truncate text-[11.5px] font-medium tabular-nums text-foreground/80">
                    {formaterMontant(fiche.montant_total)}
                  </span>
                  <span className="truncate text-[11px] text-muted-foreground tabular-nums">
                    {formaterDateHeure(fiche.date_creation)} · {libelleStatutDepot(fiche.statut)}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </aside>

      {/* Contenu de la fiche sélectionnée */}
      <div className="flex min-w-0 flex-1 flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-[12px] text-muted-foreground tabular-nums">
            Reçue le {formaterDateHeure(ficheAffichee.date_creation)}
            {ficheAffichee.genere_par ? ` · ${ficheAffichee.genere_par}` : ""}
          </p>
          <BoutonPleinEcran
            actif={pleinEcranRef !== null}
            onToggle={() =>
              pleinEcranRef !== null
                ? fermerPleinEcran()
                : setPleinEcranRef(ficheAffichee.reference)
            }
            libelleEnter="Afficher la Fiche de dépôt en plein écran"
          />
        </div>

        <ContenuDetailFicheDepot
          reference={ficheAffichee.reference}
          referenceJournee={journee.reference}
        />
      </div>

      <OverlayPleinEcran
        ouvert={pleinEcranRef !== null}
        titre="Fiche de dépôt"
        sousTitre={pleinEcranRef ?? undefined}
        onClose={fermerPleinEcran}
        ariaLabel="Fiche de dépôt en plein écran"
      >
        <TableauFicheDepotExcel fiche={ficheExcel} chargement={chargementExcel} />
      </OverlayPleinEcran>
    </div>
  );
}

import { useCallback, useEffect, useState, type ReactNode } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  ArrowDownLeft, ArrowLeft, ArrowUpRight, CalendarDays, Check, ChevronLeft, ChevronRight,
  FileText, Files, Landmark, Loader2, Lock, Pencil, Plus, Sunrise, Wallet,
  type LucideIcon,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/shared/components/ui/badge";
import { Button } from "@/shared/components/ui/button";
import {
  Tabs, TabsContent,
} from "@/shared/components/ui/tabs";
import {
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from "@/shared/components/ui/tooltip";
import { cn } from "@/shared/lib/utils";
import { listerFichesDepotDeJournee } from "@/portails/Sp/api/fiches-depot";
import { recettesJourValidees } from "@/portails/Sp/api/journees-tresorerie";
import { ContenuRecettesJour } from "@/portails/Sp/components/fiche-matinale/DialogRecettesOracle";
import { TabFicheBleue } from "@/portails/Sp/components/fiche-matinale/TabFicheBleue";
import { TabFicheDepot } from "@/portails/Sp/components/fiche-matinale/TabFicheDepot";
import { TabFicheExecution } from "@/portails/Sp/components/fiche-matinale/TabFicheExecution";
import { BoutonPleinEcran } from "@/portails/Sp/components/plein-ecran/PleinEcran";
import { formaterMontantFcfa } from "@/portails/Sp/components/fiche-bleue/fiche-bleue-affichage";
import type { FicheBleueResume } from "@/portails/Sp/types/fiche-bleue.interface";
import type { FicheExecutionDetail } from "@/portails/Sp/types/fiche-execution.interface";
import type {
  JourneeTresorerie, RecettesJourValidees,
} from "@/portails/Sp/types/journee-tresorerie.interface";

/** Ordre métier : Bleue → Recettes → Dépôt → Exécution (libellés du stepper). */
const FICHIERS = [
  {
    id: "fiche-bleue",
    titre: "Fiche Bleue",
    sousTitre: "Programmation du jour",
  },
  {
    id: "recettes",
    titre: "Recettes",
    sousTitre: "Recettes Oracle du jour",
  },
  {
    id: "fiche-depot",
    titre: "Fiche de dépôt",
    sousTitre: "Reçus du Service Règlement",
  },
  {
    id: "fiche-execution",
    titre: "Fiche d'exécution",
    sousTitre: "Fiche matinale",
  },
] as const;

type FichierId = (typeof FICHIERS)[number]["id"];

function estFichierId(valeur: string | null): valeur is FichierId {
  return FICHIERS.some((f) => f.id === valeur);
}

interface ProgrammationFicheBleue {
  soldeProgramme: string | null;
  totalRecettes: string | null;
  totalDepenses: string | null;
  dateLibelle: string;
  chargement: boolean;
}

const STYLE_ETAT: Record<string, string> = {
  brouillon: "border-transparent bg-muted text-muted-foreground",
  en_cours: "border-transparent bg-primary/10 text-primary",
  cloture: "border-transparent bg-warning/10 text-warning",
};

/** Pastille colorée devant le libellé d'état. */
const PUCE_ETAT: Record<string, string> = {
  brouillon: "bg-muted-foreground/60",
  en_cours: "bg-primary",
  cloture: "bg-warning",
};

const REF_JT_DATE = /^JT-(\d{2})-(\d{2})-(\d{4})-\d{3}$/;

function formaterDateHeure(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Date métier de la journée : portée par la référence (JT-JJ-MM-AAAA-NNN), sinon la création. */
function libelleDateJournee(journee: JourneeTresorerie): string {
  const m = REF_JT_DATE.exec(journee.reference);
  const date = m
    ? new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]))
    : new Date(journee.date_creation);
  if (Number.isNaN(date.getTime())) return "—";
  const libelle = date.toLocaleDateString("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  return libelle.charAt(0).toUpperCase() + libelle.slice(1);
}

function aFicheBleue(journee: JourneeTresorerie): boolean {
  return journee.fiche_bleue_id != null;
}

function peutOuvrirOnglet(id: FichierId, journee: JourneeTresorerie): boolean {
  if (id === "fiche-bleue") return true;
  return aFicheBleue(journee);
}

function ongletAutorise(
  demande: string | null,
  journee: JourneeTresorerie,
): FichierId {
  if (demande === "fiche-depot") return "fiche-depot";
  if (!estFichierId(demande) || !peutOuvrirOnglet(demande, journee)) {
    return FICHIERS[0].id;
  }
  return demande;
}

function etapesValides(
  journee: JourneeTresorerie,
  nombreDepots: number,
  recettesValidees: boolean,
): Set<FichierId> {
  const valides = new Set<FichierId>();
  if (!aFicheBleue(journee)) return valides;
  valides.add("fiche-bleue");
  if (recettesValidees) valides.add("recettes");
  if (nombreDepots > 0) valides.add("fiche-depot");
  if (journee.fiche_execution_id != null) valides.add("fiche-execution");
  return valides;
}

/** Montant + unité discrète ; « — » seul quand la valeur est absente. */
function Montant({ valeur }: { valeur: string | null | undefined }) {
  const texte = valeur == null ? "—" : formaterMontantFcfa(valeur);
  return (
    <>
      {texte}
      {texte !== "—" ? (
        <span className="ml-1 text-[0.7em] font-medium text-muted-foreground">FCFA</span>
      ) : null}
    </>
  );
}

/**
 * Grille d'indicateurs à séparateurs fins : le fond bordure transparaît entre
 * les cellules (gap-px), ce qui garde des traits nets en 2×2 comme en 1×4.
 */
function GrilleIndicateurs({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <dl
      className={cn(
        "grid grid-cols-1 gap-px overflow-hidden rounded-xl border bg-border @md:grid-cols-2 @3xl:grid-cols-4",
        className,
      )}
    >
      {children}
    </dl>
  );
}

function Indicateur({
  libelle,
  icone: Icone,
  tonIcone = "text-muted-foreground",
  enAvant = false,
  children,
  detail,
  className,
}: {
  libelle: string;
  icone?: LucideIcon;
  tonIcone?: string;
  enAvant?: boolean;
  children: ReactNode;
  detail?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "min-w-0 px-4 py-3",
        enAvant ? "bg-primary/[0.06]" : "bg-card",
        className,
      )}
    >
      <dt className="flex items-center gap-1.5 text-[11.5px] font-medium text-muted-foreground">
        {Icone ? <Icone className={cn("size-3.5 shrink-0", tonIcone)} aria-hidden /> : null}
        {libelle}
      </dt>
      <dd
        className={cn(
          "mt-1 truncate text-[15px] font-bold tabular-nums tracking-tight sm:text-[16px]",
          enAvant ? "text-primary" : "text-foreground",
        )}
      >
        {children}
      </dd>
      {detail ? (
        <dd className="mt-0.5 truncate text-[11.5px] text-muted-foreground">{detail}</dd>
      ) : null}
    </div>
  );
}

/** Indicateur d'une ligne pour l'en-tête compact (libellé au-dessus, valeur). */
function IndicateurCompact({
  libelle,
  icone: Icone,
  tonIcone = "text-muted-foreground",
  enAvant = false,
  children,
}: {
  libelle: string;
  icone: LucideIcon;
  tonIcone?: string;
  enAvant?: boolean;
  children: ReactNode;
}) {
  return (
    <div className="min-w-0">
      <dt className="flex items-center gap-1 text-[11px] font-medium whitespace-nowrap text-muted-foreground">
        <Icone className={cn("size-3 shrink-0", tonIcone)} aria-hidden />
        {libelle}
      </dt>
      <dd
        className={cn(
          "truncate text-[14px] font-bold tabular-nums tracking-tight",
          enAvant ? "text-primary" : "text-foreground",
        )}
      >
        {children}
      </dd>
    </div>
  );
}

interface JourneeTresorerieVueProps {
  journee: JourneeTresorerie;
  onJourneeChange?: (journee: JourneeTresorerie) => void;
}

/**
 * Vue « Journée de trésorerie » : en-tête (identité + indicateurs) puis
 * parcours des fichiers requis (stepper + panneau de l'étape).
 * Enchaînement : Fiche Bleue obligatoire → Dépôt optionnel → Exécution.
 * Une fois la Fiche Bleue liée, toutes les étapes sont cliquables ; l'étape
 * active est mise en avant aux couleurs du portail, les étapes validées
 * gardent leur coche lorsqu'elles ne sont pas sélectionnées.
 */
export function JourneeTresorerieVue({
  journee: journeeInitiale,
  onJourneeChange,
}: JourneeTresorerieVueProps) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [journee, setJournee] = useState(journeeInitiale);
  const ongletUrl = searchParams.get("onglet");
  const creerFicheBleueUrl = searchParams.get("creer") === "1";
  const [ongletActif, setOngletActif] = useState<string>(() =>
    ongletAutorise(ongletUrl, journeeInitiale),
  );
  const [nombreDepots, setNombreDepots] = useState(0);
  /** Liste de recettes du jour validée (figée) pour la journée. */
  const [recettesValidees, setRecettesValidees] = useState(false);
  const [valides, setValides] = useState<ReadonlySet<FichierId>>(() =>
    etapesValides(journeeInitiale, 0, false),
  );
  const [ficheBleueSelectionnee, setFicheBleueSelectionnee] =
    useState<FicheBleueResume | null>(null);
  const [nombreFichesBleues, setNombreFichesBleues] = useState(0);
  const [ouvrirSelectionFicheBleue, setOuvrirSelectionFicheBleue] = useState(false);
  const [ouvrirCreationFicheBleue, setOuvrirCreationFicheBleue] =
    useState(creerFicheBleueUrl && journeeInitiale.etat !== "cloture");
  const [ouvrirEditionFicheBleue, setOuvrirEditionFicheBleue] = useState(false);
  const [pleinEcranFicheBleue, setPleinEcranFicheBleue] = useState(false);
  const [actionsEditionFicheBleue, setActionsEditionFicheBleue] =
    useState<HTMLDivElement | null>(null);
  const [programmationFicheBleue, setProgrammationFicheBleue] =
    useState<ProgrammationFicheBleue | null>(null);
  const [ficheExecution, setFicheExecution] =
    useState<FicheExecutionDetail | null>(null);
  const indexActif = FICHIERS.findIndex((f) => f.id === ongletActif);
  /** Journée clôturée (non réouverte) : toutes les modifications sont désactivées. */
  const cloturee = journee.etat === "cloture";

  useEffect(() => {
    setJournee(journeeInitiale);
  }, [journeeInitiale]);

  useEffect(() => {
    setValides(etapesValides(journee, nombreDepots, recettesValidees));
  }, [journee, nombreDepots, recettesValidees]);

  useEffect(() => {
    setOngletActif((actuel) => {
      const demande = estFichierId(ongletUrl) ? ongletUrl : actuel;
      return ongletAutorise(demande, journee);
    });
  }, [ongletUrl, journee.fiche_bleue_id]);

  useEffect(() => {
    if (!creerFicheBleueUrl || cloturee) return;
    setOuvrirSelectionFicheBleue(false);
    setOuvrirEditionFicheBleue(false);
    setOuvrirCreationFicheBleue(true);
    setOngletActif("fiche-bleue");
  }, [creerFicheBleueUrl, cloturee]);

  function allerCreerFicheBleue() {
    if (cloturee) return;
    setOuvrirSelectionFicheBleue(false);
    setOuvrirEditionFicheBleue(false);
    setOuvrirCreationFicheBleue(true);
    setOngletActif("fiche-bleue");
  }

  useEffect(() => {
    let annule = false;
    void listerFichesDepotDeJournee(journee.reference)
      .then((page) => {
        if (!annule) setNombreDepots(page.fiches?.length ?? 0);
      })
      .catch(() => {
        if (!annule) setNombreDepots(0);
      });
    return () => {
      annule = true;
    };
  }, [journee.reference, journee.fiche_bleue_id]);

  useEffect(() => {
    let annule = false;
    void recettesJourValidees(journee.reference)
      .then(({ recettes_jour }) => {
        if (!annule) setRecettesValidees(recettes_jour != null);
      })
      .catch(() => {
        if (!annule) setRecettesValidees(false);
      });
    return () => {
      annule = true;
    };
  }, [journee.reference]);

  const onRecettesValideesChange = useCallback((liste: RecettesJourValidees | null) => {
    setRecettesValidees(liste != null);
  }, []);

  const onFicheSelectionneeChange = useCallback((fiche: FicheBleueResume | null) => {
    setFicheBleueSelectionnee(fiche);
  }, []);

  const onFicheExecutionChange = useCallback((fiche: FicheExecutionDetail | null) => {
    setFicheExecution(fiche);
  }, []);

  const majJournee = useCallback((maj: JourneeTresorerie) => {
    setJournee(maj);
    onJourneeChange?.(maj);
  }, [onJourneeChange]);

  function allerOnglet(id: FichierId) {
    if (!peutOuvrirOnglet(id, journee)) {
      toast.error("Créez d'abord la Fiche Bleue avant d'ouvrir cet onglet.");
      return;
    }
    setOngletActif(id);
  }

  function allerPrecedent() {
    if (indexActif <= 0) return;
    setOngletActif(FICHIERS[indexActif - 1].id);
  }

  function allerSuivant() {
    if (indexActif < 0 || indexActif >= FICHIERS.length - 1) return;
    const courant = FICHIERS[indexActif];
    if (courant.id === "fiche-bleue" && !aFicheBleue(journee)) {
      toast.error("Sélectionnez ou créez une Fiche Bleue avant de continuer.");
      return;
    }
    if (!aFicheBleue(journee)) {
      toast.error("Créez d'abord la Fiche Bleue.");
      return;
    }
    setOngletActif(FICHIERS[indexActif + 1].id);
  }

  function validerDernier() {
    if (indexActif !== FICHIERS.length - 1) return;
    if (!ficheExecution) {
      toast.error("La Fiche d'exécution n'est pas encore disponible.");
      return;
    }
    toast.success("Fiche d'exécution validée.");
    void navigate("/sp/fiche-matinale", {
      replace: true,
      state: { journeeValidee: journee },
    });
  }

  return (
    <TooltipProvider>
      <div className="@container flex w-full flex-col gap-4 py-1">
        {/* ── En-tête compact : identité de la journée + indicateurs sur une bande ── */}
        <section
          aria-label="Synthèse de la journée"
          className="flex flex-col gap-3 rounded-xl border border-l-4 border-l-primary bg-card px-3 py-2.5 shadow-sm @4xl:flex-row @4xl:items-center @4xl:gap-5 sm:px-4"
        >
          <div className="flex min-w-0 items-center gap-2.5">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  className="shrink-0"
                  aria-label="Retour à la fiche matinale"
                  onClick={() => void navigate("/sp/fiche-matinale")}
                >
                  <ArrowLeft className="size-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Retour à la fiche matinale</TooltipContent>
            </Tooltip>

            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                <h2 className="truncate text-[15px] font-bold tabular-nums tracking-tight text-foreground sm:text-[16px]">
                  {journee.reference}
                </h2>
                <Badge className={cn("gap-1.5", STYLE_ETAT[journee.etat] ?? STYLE_ETAT.brouillon)}>
                  <span
                    className={cn(
                      "size-1.5 rounded-full",
                      PUCE_ETAT[journee.etat] ?? PUCE_ETAT.brouillon,
                    )}
                    aria-hidden
                  />
                  {journee.etat_libelle}
                </Badge>
              </div>
              <p
                className="flex items-center gap-1.5 truncate text-[12px] text-muted-foreground tabular-nums"
                title={`Créée le ${formaterDateHeure(journee.date_creation)} · Mise à jour ${formaterDateHeure(journee.date_derniere_mise_a_jour)}`}
              >
                <CalendarDays className="size-3.5 shrink-0 text-primary" aria-hidden />
                <span className="truncate">
                  <span className="font-medium text-foreground/80">{libelleDateJournee(journee)}</span>
                  <span className="mx-1.5 text-muted-foreground/50" aria-hidden>·</span>
                  Màj {formaterDateHeure(journee.date_derniere_mise_a_jour)}
                </span>
              </p>
            </div>
          </div>

          <dl className="grid grid-cols-2 gap-x-4 gap-y-2 border-t pt-2.5 @xl:grid-cols-4 @4xl:ml-auto @4xl:border-t-0 @4xl:border-l @4xl:pt-0 @4xl:pl-5">
            <IndicateurCompact libelle="Solde d'ouverture" icone={Wallet}>
              <Montant valeur={journee.solde_ouverture} />
            </IndicateurCompact>
            <IndicateurCompact libelle="Recettes" icone={ArrowDownLeft} tonIcone="text-success">
              <Montant valeur={journee.total_recettes} />
            </IndicateurCompact>
            <IndicateurCompact libelle="Dépenses" icone={ArrowUpRight} tonIcone="text-destructive">
              <Montant valeur={journee.total_depenses} />
            </IndicateurCompact>
            <IndicateurCompact libelle="Solde de clôture" icone={Landmark} tonIcone="text-primary" enAvant>
              <Montant valeur={journee.solde_cloture} />
            </IndicateurCompact>
          </dl>
        </section>

        {/* ── Parcours des fichiers requis ── */}
        <section className="w-full space-y-3">
          <div className="flex items-baseline justify-between gap-2">
            <h3 className="text-[11px] font-semibold tracking-[0.12em] text-primary uppercase sm:text-[12px]">
              Fichiers requis
            </h3>
            <p className="text-[12px] font-medium text-muted-foreground tabular-nums">
              {valides.size} / {FICHIERS.length} complété{valides.size > 1 ? "s" : ""}
            </p>
          </div>

          {cloturee ? (
            <div
              className="flex items-start gap-2 rounded-lg border border-warning/30 bg-warning/10 px-3 py-2 text-[12.5px] text-foreground"
              role="status"
            >
              <Lock className="mt-0.5 size-3.5 shrink-0 text-warning" aria-hidden />
              <p>
                <span className="font-semibold">Journée clôturée : consultation uniquement.</span>{" "}
                Aucune modification n&apos;est possible tant que la journée n&apos;est pas réouverte.
              </p>
            </div>
          ) : null}

          <ol className="grid w-full grid-cols-2 gap-2 @2xl:grid-cols-4 sm:gap-3" aria-label="Étapes fichiers requis">
            {FICHIERS.map((fichier, index) => {
              const estActif = fichier.id === ongletActif;
              const estValide = valides.has(fichier.id);
              const verrouille = !peutOuvrirOnglet(fichier.id, journee);
              return (
                <li key={fichier.id} className="min-w-0">
                  <button
                    type="button"
                    aria-current={estActif ? "step" : undefined}
                    aria-disabled={verrouille || undefined}
                    title={verrouille ? "Créez d'abord la Fiche Bleue" : undefined}
                    onClick={() => allerOnglet(fichier.id)}
                    className={cn(
                      "group relative flex h-full w-full items-center gap-2.5 overflow-hidden rounded-xl border px-2.5 py-2.5 text-left transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/40 sm:gap-3 sm:px-3.5 sm:py-3",
                      estActif
                        ? "border-primary/50 bg-primary/[0.07] shadow-sm"
                        : estValide
                          ? "border-success/30 bg-card hover:bg-success/[0.04]"
                          : "border-border bg-card hover:bg-muted/50",
                      verrouille && "cursor-not-allowed bg-muted/40 hover:bg-muted/40",
                    )}
                  >
                    <span
                      className={cn(
                        "flex size-7 shrink-0 items-center justify-center rounded-full text-[12px] font-bold sm:size-8",
                        estActif
                          ? "bg-primary text-primary-foreground"
                          : estValide
                            ? "bg-success text-success-foreground"
                            : "bg-muted text-muted-foreground ring-1 ring-border",
                      )}
                    >
                      {verrouille ? (
                        <Lock className="size-3.5" />
                      ) : estValide && !estActif ? (
                        <Check className="size-3.5" strokeWidth={3} />
                      ) : (
                        index + 1
                      )}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="hidden text-[10.5px] font-medium tracking-wide text-muted-foreground uppercase @xl:block">
                        Étape {index + 1}
                        {estValide ? " · Complétée" : ""}
                      </span>
                      <span
                        className={cn(
                          "block text-[12.5px] leading-tight font-semibold sm:text-[13.5px]",
                          estActif
                            ? "text-foreground"
                            : verrouille
                              ? "text-muted-foreground"
                              : "text-foreground/85",
                        )}
                      >
                        {fichier.titre}
                      </span>
                      <span className="hidden truncate text-[11.5px] text-muted-foreground @2xl:block">
                        {fichier.sousTitre}
                      </span>
                    </span>
                    {estActif ? (
                      <span className="absolute inset-x-0 bottom-0 h-0.5 bg-primary" aria-hidden />
                    ) : null}
                  </button>
                </li>
              );
            })}
          </ol>

          <Tabs value={ongletActif} className="flex w-full flex-col">
            {FICHIERS.map((fichier, index) => {
              const estPremier = index === 0;
              const estDernier = index === FICHIERS.length - 1;
              const estValide = valides.has(fichier.id);

              return (
                <TabsContent
                  key={fichier.id}
                  value={fichier.id}
                  className="w-full overflow-hidden rounded-2xl border bg-card shadow-sm"
                >
                  {/* Corps du panneau (sans en-tête : le stepper nomme déjà l'étape) */}
                  <div className="flex flex-col gap-4 px-4 py-4 sm:px-6 sm:py-5">
                    {fichier.id === "fiche-bleue" && (nombreFichesBleues > 1 || ficheBleueSelectionnee) ? (
                      <div className="flex flex-wrap items-center justify-end gap-2">
                        {!cloturee && nombreFichesBleues > 1 && !ouvrirEditionFicheBleue && !ouvrirCreationFicheBleue ? (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="gap-1.5"
                            onClick={() => {
                              setOuvrirCreationFicheBleue(false);
                              setOuvrirEditionFicheBleue(false);
                              setOuvrirSelectionFicheBleue(true);
                            }}
                          >
                            <Files className="size-3.5" />
                            Sélectionner ({nombreFichesBleues})
                          </Button>
                        ) : null}
                        {ouvrirEditionFicheBleue ? (
                          <div
                            ref={setActionsEditionFicheBleue}
                            className="flex flex-wrap items-center gap-2"
                          />
                        ) : ficheBleueSelectionnee && !ouvrirCreationFicheBleue ? (
                          <>
                            {cloturee ? null : (
                            <>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="gap-1.5"
                              onClick={() => {
                                setPleinEcranFicheBleue(false);
                                setOuvrirSelectionFicheBleue(false);
                                setOuvrirCreationFicheBleue(false);
                                setOuvrirEditionFicheBleue(true);
                              }}
                            >
                              <Pencil className="size-3.5" />
                              Modifier
                            </Button>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="gap-1.5"
                              onClick={() => {
                                setPleinEcranFicheBleue(false);
                                setOuvrirSelectionFicheBleue(false);
                                setOuvrirEditionFicheBleue(false);
                                setOuvrirCreationFicheBleue(true);
                              }}
                            >
                              <Plus className="size-3.5" />
                              Nouvelle fiche
                            </Button>
                            </>
                            )}
                            <BoutonPleinEcran
                              actif={pleinEcranFicheBleue}
                              onToggle={() => setPleinEcranFicheBleue((v) => !v)}
                              libelleEnter="Afficher la Fiche Bleue en plein écran"
                            />
                          </>
                        ) : null}
                      </div>
                    ) : null}

                    {fichier.id === "fiche-bleue" && ficheBleueSelectionnee ? (
                      <GrilleIndicateurs className="bg-border/70">
                        <Indicateur
                          libelle="Fiche sélectionnée"
                          icone={FileText}
                          tonIcone="text-primary"
                          detail={
                            <>
                              {ficheBleueSelectionnee.section_solde ?? "—"}
                              {" · "}
                              {ficheBleueSelectionnee.nombre_sections} section
                              {ficheBleueSelectionnee.nombre_sections > 1 ? "s" : ""}
                            </>
                          }
                        >
                          {ficheBleueSelectionnee.reference}
                        </Indicateur>
                        {programmationFicheBleue?.chargement ? (
                          <div className="flex items-center gap-2 bg-card px-4 py-3 text-[13px] text-muted-foreground @3xl:col-span-3">
                            <Loader2 className="size-4 animate-spin" />
                            Chargement des montants…
                          </div>
                        ) : (
                          <>
                            <Indicateur libelle="Solde programmé" icone={Wallet}>
                              <Montant valeur={programmationFicheBleue?.soldeProgramme} />
                            </Indicateur>
                            <Indicateur libelle="Recettes prog." icone={ArrowDownLeft} tonIcone="text-success">
                              <Montant valeur={programmationFicheBleue?.totalRecettes} />
                            </Indicateur>
                            <Indicateur libelle="Dépenses prog." icone={ArrowUpRight} tonIcone="text-destructive">
                              <Montant valeur={programmationFicheBleue?.totalDepenses} />
                            </Indicateur>
                          </>
                        )}
                      </GrilleIndicateurs>
                    ) : null}

                    {fichier.id === "fiche-execution" && ficheExecution ? (
                      <GrilleIndicateurs className="bg-border/70">
                        <Indicateur libelle="Fiche d'exécution" icone={Sunrise} tonIcone="text-primary">
                          {ficheExecution.reference}
                        </Indicateur>
                        <Indicateur libelle="Programmé">
                          <Montant valeur={ficheExecution.montant_total_programme} />
                        </Indicateur>
                        <Indicateur libelle="Réalisé">
                          <Montant valeur={ficheExecution.montant_total_realise} />
                        </Indicateur>
                        <Indicateur libelle="Écart">
                          <Montant
                            valeur={
                              Number(ficheExecution.montant_total_realise) === 0
                                ? null
                                : ficheExecution.montant_total_ecart
                            }
                          />
                        </Indicateur>
                      </GrilleIndicateurs>
                    ) : null}

                    <div className="min-w-0">
                      {fichier.id === "fiche-bleue" ? (
                        <TabFicheBleue
                          journee={journee}
                          onJourneeChange={majJournee}
                          onFicheSelectionneeChange={onFicheSelectionneeChange}
                          onNombreFichesDisponiblesChange={setNombreFichesBleues}
                          onProgrammationChange={setProgrammationFicheBleue}
                          ouvrirSelection={ouvrirSelectionFicheBleue}
                          onFermerSelection={() => setOuvrirSelectionFicheBleue(false)}
                          ouvrirCreation={ouvrirCreationFicheBleue}
                          onFermerCreation={() => setOuvrirCreationFicheBleue(false)}
                          ouvrirEdition={ouvrirEditionFicheBleue}
                          onFermerEdition={() => setOuvrirEditionFicheBleue(false)}
                          conteneurActionsEdition={actionsEditionFicheBleue}
                          pleinEcran={pleinEcranFicheBleue}
                          onPleinEcranChange={setPleinEcranFicheBleue}
                          actif={ongletActif === "fiche-bleue"}
                        />
                      ) : fichier.id === "recettes" ? (
                        <ContenuRecettesJour
                          integre
                          actif={ongletActif === "recettes"}
                          referenceJournee={journee.reference}
                          lectureSeule={journee.etat === "cloture"}
                          onValideeChange={onRecettesValideesChange}
                        />
                      ) : fichier.id === "fiche-depot" ? (
                        <TabFicheDepot
                          journee={journee}
                          actif={ongletActif === "fiche-depot"}
                          onNombreFichesChange={setNombreDepots}
                        />
                      ) : (
                        <TabFicheExecution
                          journee={journee}
                          onJourneeChange={majJournee}
                          onFicheChange={onFicheExecutionChange}
                          onCreerFicheBleue={allerCreerFicheBleue}
                          actif={ongletActif === "fiche-execution"}
                        />
                      )}
                    </div>
                  </div>

                  {/* Pied du panneau : navigation entre étapes */}
                  <div className="flex items-center justify-between gap-2 border-t bg-muted/30 px-4 py-3 sm:px-6">
                    <div className="flex min-w-[7.5rem] justify-start">
                      {estPremier ? null : (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={allerPrecedent}
                          className="gap-1.5 bg-card"
                        >
                          <ChevronLeft className="size-3.5" />
                          Précédent
                        </Button>
                      )}
                    </div>

                    <div
                      className="flex items-center gap-1.5"
                      aria-label={`Étape ${index + 1} sur ${FICHIERS.length}`}
                    >
                      {FICHIERS.map((f, i) => (
                        <span
                          key={f.id}
                          className={cn(
                            "h-1.5 rounded-full transition-all",
                            i === index
                              ? "w-5 bg-primary"
                              : valides.has(f.id)
                                ? "w-1.5 bg-success"
                                : "w-1.5 bg-muted-foreground/25",
                          )}
                          aria-hidden
                        />
                      ))}
                    </div>

                    <div className="flex min-w-[7.5rem] justify-end">
                      {estDernier ? (
                        <Button
                          type="button"
                          size="sm"
                          disabled={!ficheExecution || cloturee}
                          onClick={validerDernier}
                          className="gap-1.5 bg-success text-success-foreground hover:bg-success/90"
                        >
                          <Check className="size-3.5" />
                          {estValide ? "Validé" : "Valider"}
                        </Button>
                      ) : fichier.id === "fiche-bleue" && journee.fiche_bleue_id === null ? null : (
                        <Button
                          type="button"
                          size="sm"
                          onClick={allerSuivant}
                          className="gap-1.5 hover:bg-primary/90"
                        >
                          Suivant
                          <ChevronRight className="size-3.5" />
                        </Button>
                      )}
                    </div>
                  </div>
                </TabsContent>
              );
            })}
          </Tabs>
        </section>
      </div>
    </TooltipProvider>
  );
}

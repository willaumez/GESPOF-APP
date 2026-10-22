import { useEffect, useMemo, useState } from "react";
import {
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Loader2,
  RotateCcw,
  Sunrise,
  X,
} from "lucide-react";
import { toast } from "sonner";
import type { DateRange } from "react-day-picker";
import { PAGINATION } from "@/shared/config/app";
import { getPortalMenu } from "@/shared/config/menu";
import { cn } from "@/shared/lib/utils";
import {
  PeriodDatePicker,
  periodeVersIso,
} from "@/shared/components/date/PeriodDatePicker";
import { Badge } from "@/shared/components/ui/badge";
import { Button } from "@/shared/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/shared/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/shared/components/ui/popover";
import {
  dateIsoDepuisReferenceJournee,
  ETAT_JOURNEE,
} from "@/portails/Sp/components/archives/archives-affichage";
import {
  dateIsoJour,
  libelleDateFr,
} from "@/portails/Sp/components/fiche-bleue/fiche-bleue-affichage";
import { listerJourneesTresorerie } from "@/portails/Sp/api/journees-tresorerie";
import { useJourneeSelectionnee } from "@/portails/Sp/hooks/journee-selectionnee";
import type { JourneeTresorerie } from "@/portails/Sp/types/journee-tresorerie.interface";

/** Page courte : le popover doit rester compact. */
const TAILLE_PAGE = PAGINATION.TAILLE_PAR_DEFAUT;

/** Journée passée réouverte : bleu, distinct de l'ambre « Journée passée ». */
const CLASSE_BADGE_REOUVERTE =
  "gap-1 border-transparent bg-sky-100 text-[10px] font-semibold text-sky-800";

function BadgeReouverte({ className }: { className?: string }) {
  return (
    <Badge className={cn(CLASSE_BADGE_REOUVERTE, className)}>
      <RotateCcw className="size-2.5" />
      Réouverte
    </Badge>
  );
}

/** Masque la coche intégrée de CommandItem : la sélection a son propre marquage. */
const CLASSE_ITEM =
  "gap-3 rounded-lg border border-transparent px-2.5 py-2 data-selected:bg-muted/70 [&>svg:last-child]:hidden";

/** « 03/10/2026 » → « 03-10-2026 » : la recherche backend porte sur la référence JT-jj-mm-aaaa-nnn. */
function termeRecherche(saisie: string): string {
  return saisie.trim().replace(/\//g, "-");
}

function dateDepuisIso(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}

/** « lundi 5 octobre 2026 » */
function jourLong(iso: string): string {
  return dateDepuisIso(iso).toLocaleDateString("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

/** « Octobre 2026 » (titre de groupe). */
function moisLong(iso: string): string {
  const libelle = dateDepuisIso(iso).toLocaleDateString("fr-FR", {
    month: "long",
    year: "numeric",
  });
  return libelle.charAt(0).toUpperCase() + libelle.slice(1);
}

/** Journées regroupées par mois, dans l'ordre reçu (plus récentes d'abord). */
function grouperParMois(journees: JourneeTresorerie[]) {
  const groupes: {
    mois: string;
    journees: { journee: JourneeTresorerie; iso: string }[];
  }[] = [];
  for (const j of journees) {
    const iso =
      dateIsoDepuisReferenceJournee(j.reference) ??
      j.date_creation.slice(0, 10);
    const mois = moisLong(iso);
    const dernier = groupes[groupes.length - 1];
    if (dernier?.mois === mois) dernier.journees.push({ journee: j, iso });
    else groupes.push({ mois, journees: [{ journee: j, iso }] });
  }
  return groupes;
}

/** Tuile calendrier : jour + mois abrégé ; pleine quand la journée est sélectionnée. */
function TuileDate({
  iso,
  active,
  couleur,
  fond,
}: {
  iso: string;
  active: boolean;
  couleur: string;
  fond: string;
}) {
  const d = dateDepuisIso(iso);
  return (
    <span
      className="flex size-10 shrink-0 flex-col items-center justify-center rounded-lg leading-none"
      style={
        active
          ? { background: couleur, color: "#fff" }
          : { background: fond, color: couleur }
      }
    >
      <span className="text-[15px] font-bold tabular-nums">{d.getDate()}</span>
      <span className="mt-0.5 text-[9px] font-semibold uppercase tracking-wide opacity-80">
        {d.toLocaleDateString("fr-FR", { month: "short" }).replace(".", "")}
      </span>
    </span>
  );
}

interface SelecteurJourneeSpProps {
  /** Appelé après un choix (ex. quitter l'onglet « liste » pour afficher la journée). */
  onSelection?: (reference: string | null) => void;
}

/**
 * Sélecteur de la journée de trésorerie (TopBar SP, toutes les pages) : les
 * données affichées (tableau de bord, fiches, archives…) sont celles de la journée choisie.
 */
export function SelecteurJourneeSp({ onSelection }: SelecteurJourneeSpProps) {
  const theme = getPortalMenu("sp").theme;
  const { reference, journee, chargement, date, estDuJour, selectionner } =
    useJourneeSelectionnee();

  const [ouvert, setOuvert] = useState(false);
  const [saisie, setSaisie] = useState("");
  const [terme, setTerme] = useState("");
  const [journees, setJournees] = useState<JourneeTresorerie[]>([]);
  const [page, setPage] = useState<number>(PAGINATION.PAGE_PAR_DEFAUT);
  const [pages, setPages] = useState(1);
  const [total, setTotal] = useState(0);
  /** Filtre « Période » appliqué à la liste des journées (côté backend). */
  const [periode, setPeriode] = useState<DateRange | undefined>();
  const { dateDebut, dateFin } = periodeVersIso(periode);
  const filtreActif = terme !== "" || dateDebut !== "" || dateFin !== "";
  /** Journée du jour lue dans un chargement non filtré (un filtre peut l'exclure). */
  const [duJourListe, setDuJourListe] = useState<{
    connu: boolean;
    journee: JourneeTresorerie | null;
  }>({ connu: false, journee: null });
  /** Journées passées réouvertes (toujours visibles, indépendamment des filtres). */
  const [reouvertes, setReouvertes] = useState<JourneeTresorerie[]>([]);
  /** Dernière requête terminée : chargement tant qu'elle diffère de la courante. */
  const [cleChargee, setCleChargee] = useState<string | null>(null);
  const cle = `${page}|${terme}|${dateDebut}|${dateFin}`;
  const chargementListe = ouvert && cleChargee !== cle;

  useEffect(() => {
    const t = window.setTimeout(() => setTerme(termeRecherche(saisie)), 300);
    return () => window.clearTimeout(t);
  }, [saisie]);

  useEffect(() => {
    if (!ouvert) return;
    let annule = false;
    const aujourdhui = dateIsoJour();
    listerJourneesTresorerie({
      page,
      limite: TAILLE_PAGE,
      q: terme || undefined,
      date_debut: dateDebut || undefined,
      date_fin: dateFin || undefined,
    })
      .then((data) => {
        if (annule) return;
        const recues = data.journees ?? [];
        const pagesRecues = Math.max(1, data.pages ?? 1);
        const pageRecue = Math.min(
          Math.max(1, data.page ?? page),
          pagesRecues,
        );
        setJournees(recues);
        setPages(pagesRecues);
        setTotal(data.total ?? recues.length);
        // Sans filtre, la première page (plus récentes d'abord) contient la journée du jour.
        if (pageRecue === 1 && !terme && !dateDebut && !dateFin) {
          setDuJourListe({
            connu: true,
            journee:
              recues.find(
                (j) => dateIsoDepuisReferenceJournee(j.reference) === aujourdhui,
              ) ?? null,
          });
        }
        // Backend a borné la page (filtre qui réduit le total) → resynchroniser.
        if (pageRecue !== page) {
          setPage(pageRecue);
          return;
        }
        setCleChargee(`${page}|${terme}|${dateDebut}|${dateFin}`);
      })
      .catch((e) => {
        if (annule) return;
        setCleChargee(`${page}|${terme}|${dateDebut}|${dateFin}`);
        toast.error(
          e instanceof Error
            ? e.message
            : "Impossible de charger les journées de trésorerie.",
        );
      });
    return () => {
      annule = true;
    };
  }, [ouvert, page, terme, dateDebut, dateFin]);

  // Rechargées au montage, à chaque ouverture du sélecteur et quand l'état de la
  // journée affichée change (clôture / réouverture).
  useEffect(() => {
    let annule = false;
    const aujourdhui = dateIsoJour();
    listerJourneesTresorerie({ etat: "en_cours", limite: "all" })
      .then((data) => {
        if (annule) return;
        setReouvertes(
          (data.journees ?? []).filter(
            (j) =>
              j.reouverte === true
              && dateIsoDepuisReferenceJournee(j.reference) !== aujourdhui,
          ),
        );
      })
      .catch(() => {
        /* indicateur secondaire : pas de toast */
      });
    return () => {
      annule = true;
    };
  }, [ouvert, journee?.reference, journee?.etat]);

  function changerOuverture(prochain: boolean) {
    setOuvert(prochain);
    if (!prochain) {
      setSaisie("");
      setTerme("");
      setPeriode(undefined);
      setPage(PAGINATION.PAGE_PAR_DEFAUT);
      setCleChargee(null);
    }
  }

  function allerPage(prochaine: number) {
    setPage(Math.max(1, Math.min(prochaine, pages)));
  }

  function choisir(prochaine: string | null) {
    if (prochaine !== reference) selectionner(prochaine);
    changerOuverture(false);
    onSelection?.(prochaine);
  }

  const etat = journee
    ? (ETAT_JOURNEE[journee.etat] ?? ETAT_JOURNEE.brouillon)
    : null;
  /** La journée consultée n'est pas celle d'aujourd'hui : signalé en ambre. */
  const autreJournee = !estDuJour;
  const aujourdhuiIso = dateIsoJour();
  /** Journée(s) du jour présentée(s) une seule fois, en tête : exclues de la liste. */
  const groupes = useMemo(
    () =>
      grouperParMois(
        journees.filter(
          (j) => dateIsoDepuisReferenceJournee(j.reference) !== aujourdhuiIso,
        ),
      ),
    [journees, aujourdhuiIso],
  );
  // En suivi automatique, le contexte porte déjà la journée du jour ; sinon, celle
  // relevée dans le dernier chargement non filtré de la liste.
  const duJourSelectionne = reference === null;
  const journeeDuJour = duJourSelectionne ? journee : duJourListe.journee;
  const etatDuJour = journeeDuJour
    ? (ETAT_JOURNEE[journeeDuJour.etat] ?? ETAT_JOURNEE.brouillon)
    : null;
  const etatDuJourInconnu = !duJourSelectionne && !duJourListe.connu;

  /** Réouvertes autres que la journée affichée (celle-ci porte déjà son badge). */
  const nombreAutresReouvertes = reouvertes.filter(
    (j) => j.reference !== journee?.reference,
  ).length;

  /** Ligne sélectionnée : fond teinté + liseré à gauche (distinct du survol clavier). */
  const styleSelection = {
    background: `${theme.topColor}14`,
    borderColor: `${theme.topColor}55`,
    boxShadow: `inset 3px 0 0 ${theme.topColor}`,
  };
  const marqueSelection = (
    <span
      className="flex items-center gap-1 text-[10.5px] font-semibold"
      style={{ color: theme.hoverColor }}
    >
      <CheckCircle2 className="size-3" />
      Sélectionnée
    </span>
  );

  return (
    <Popover open={ouvert} onOpenChange={changerOuverture}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          className="h-10 w-full min-w-0 max-w-full justify-start gap-2 rounded-xl border-2 bg-card px-2 pr-2.5 font-normal shadow-sm hover:bg-card hover:shadow-md aria-expanded:bg-card aria-expanded:shadow-md @2xl/topbar:gap-2.5 @4xl/topbar:w-auto @4xl/topbar:max-w-[34rem] @6xl/topbar:min-w-[24rem]"
          style={{
            borderColor: ouvert ? theme.topColor : autreJournee ? "#f59e0b" : `${theme.topColor}33`,
            boxShadow: ouvert ? `0 0 0 3px ${theme.topColor}22` : undefined,
            background: autreJournee ? "#fffbeb" : undefined,
          }}
          aria-label={
            autreJournee
              ? `Journée du ${libelleDateFr(date)} (pas aujourd'hui) : changer de journée`
              : "Sélectionner la journée de trésorerie"
          }
          title={autreJournee ? "Vous consultez une journée passée, pas celle d'aujourd'hui." : undefined}
        >
          <span
            className="flex size-7 shrink-0 items-center justify-center rounded-lg"
            style={
              autreJournee
                ? { background: "#fef3c7", color: "#b45309" }
                : { background: theme.iconBg, color: theme.iconColor }
            }
          >
            <CalendarDays className="size-3.5" />
          </span>
          <span className="flex min-w-0 items-baseline gap-2">
            <span className="hidden text-[10px] font-semibold uppercase tracking-[0.14em] text-foreground/45 @2xl/topbar:inline">
              Journée
            </span>
            <span className="truncate font-semibold tabular-nums text-[#0f172a]">
              {libelleDateFr(date)}
            </span>
            {journee ? (
              <span className="hidden truncate font-mono text-[11px] text-muted-foreground @7xl/topbar:inline">
                {journee.reference}
              </span>
            ) : null}
          </span>
          {autreJournee ? (
            journee?.reouverte ? (
              <BadgeReouverte className="shrink-0" />
            ) : (
              <Badge className="shrink-0 border-transparent bg-amber-200 text-[10px] font-semibold text-amber-950">
                Journée passée
              </Badge>
            )
          ) : null}
          {chargement ? (
            <Loader2 className="size-3.5 shrink-0 animate-spin text-muted-foreground" />
          ) : etat ? (
            <Badge
              className={cn(
                "hidden shrink-0 @md/topbar:inline-flex",
                etat.badge,
              )}
            >
              {etat.label}
            </Badge>
          ) : estDuJour ? (
            <Badge className="hidden shrink-0 border-transparent bg-muted text-muted-foreground @md/topbar:inline-flex">
              Non ouverte
            </Badge>
          ) : null}
          {nombreAutresReouvertes > 0 ? (
            <span
              className="ml-auto inline-flex shrink-0 items-center gap-0.5 rounded-full bg-sky-600 px-1.5 py-0.5 text-[10px] font-bold tabular-nums text-white"
              title={`${nombreAutresReouvertes} journée${nombreAutresReouvertes > 1 ? "s" : ""} passée${nombreAutresReouvertes > 1 ? "s" : ""} réouverte${nombreAutresReouvertes > 1 ? "s" : ""}`}
              aria-label={`${nombreAutresReouvertes} journée${nombreAutresReouvertes > 1 ? "s" : ""} passée${nombreAutresReouvertes > 1 ? "s" : ""} réouverte${nombreAutresReouvertes > 1 ? "s" : ""}`}
            >
              <RotateCcw className="size-2.5" />
              {nombreAutresReouvertes}
            </span>
          ) : null}
          <ChevronDown
            className={cn(
              "size-3.5 shrink-0 text-muted-foreground",
              nombreAutresReouvertes > 0 ? "ml-0" : "ml-auto",
            )}
          />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="center"
        sideOffset={8}
        collisionPadding={8}
        className="w-[min(34rem,calc(100vw-1rem))] min-w-(--radix-popover-trigger-width) gap-0 overflow-hidden p-0"
      >
        {/* Journée du jour, présentée une seule fois : créée ou non, son état, suivi auto. */}
        <div
          className="border-b p-1.5"
          style={{ borderColor: `${theme.topColor}22` }}
        >
          <button
            type="button"
            onClick={() => choisir(null)}
            aria-current={duJourSelectionne ? "true" : undefined}
            className="flex w-full items-center gap-3 rounded-lg border border-transparent px-2.5 py-2.5 text-left transition-colors hover:bg-muted/70 focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none"
            style={duJourSelectionne ? styleSelection : undefined}
          >
            <TuileDate
              iso={aujourdhuiIso}
              active={duJourSelectionne}
              couleur={theme.topColor}
              fond={theme.iconBg}
            />
            <span className="flex min-w-0 flex-1 flex-col">
              <span
                className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-[0.14em]"
                style={{ color: theme.iconColor }}
              >
                <Sunrise className="size-3" />
                Journée actuelle
              </span>
              <span className="truncate text-[13.5px] font-semibold capitalize text-[#0f172a]">
                {jourLong(aujourdhuiIso)}
              </span>
              <span className="truncate font-mono text-[11px] text-muted-foreground">
                {etatDuJourInconnu
                  ? "Vérification…"
                  : (journeeDuJour?.reference ?? "Pas encore ouverte")}
              </span>
            </span>
            <span className="flex shrink-0 flex-col items-end gap-1">
              {etatDuJourInconnu ? (
                <Loader2 className="size-3.5 animate-spin text-muted-foreground" />
              ) : etatDuJour ? (
                <Badge className={etatDuJour.badge}>{etatDuJour.label}</Badge>
              ) : (
                <Badge className="border-transparent bg-muted text-muted-foreground">
                  Non ouverte
                </Badge>
              )}
              {duJourSelectionne ? marqueSelection : null}
            </span>
          </button>
        </div>

        {/* Journées passées réouvertes : accès direct, toujours visibles. */}
        {reouvertes.length > 0 ? (
          <div className="border-b bg-sky-50/60 p-1.5">
            <p className="flex items-center gap-1 px-2.5 pt-1 pb-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-sky-800">
              <RotateCcw className="size-3" />
              Journées passées réouvertes ({reouvertes.length})
            </p>
            <ul className="max-h-40 overflow-y-auto">
              {reouvertes.map((j) => {
                const iso =
                  dateIsoDepuisReferenceJournee(j.reference) ??
                  j.date_creation.slice(0, 10);
                const selectionnee = reference === j.reference;
                return (
                  <li key={j.reference}>
                    <button
                      type="button"
                      onClick={() => choisir(j.reference)}
                      aria-current={selectionnee ? "true" : undefined}
                      className="flex w-full items-center gap-3 rounded-lg border border-transparent px-2.5 py-2 text-left transition-colors hover:bg-background/80 focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none"
                      style={selectionnee ? styleSelection : undefined}
                    >
                      <TuileDate
                        iso={iso}
                        active={selectionnee}
                        couleur={theme.topColor}
                        fond={theme.iconBg}
                      />
                      <span className="flex min-w-0 flex-1 flex-col">
                        <span className="truncate text-[13px] font-semibold capitalize">
                          {jourLong(iso)}
                        </span>
                        <span className="truncate font-mono text-[11px] text-muted-foreground">
                          {j.reference}
                        </span>
                      </span>
                      <span className="flex shrink-0 flex-col items-end gap-1">
                        <BadgeReouverte />
                        {selectionnee ? marqueSelection : null}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        ) : null}

        <Command shouldFilter={false} className="rounded-none! p-1.5">
          {/* Recherche + filtre « Période » sur la liste des journées. */}
          <div className="flex flex-wrap items-center gap-1.5 pr-1 [&>[data-slot=command-input-wrapper]]:min-w-[12rem] [&>[data-slot=command-input-wrapper]]:flex-1">
            <CommandInput
              placeholder="Rechercher une date (jj/mm/aaaa) ou une référence…"
              value={saisie}
              onValueChange={(v) => {
                setSaisie(v);
                setPage(PAGINATION.PAGE_PAR_DEFAUT);
              }}
            />
            <div className="flex items-center gap-1 pt-1">
              <PeriodDatePicker
                portail="sp"
                variant="filtre"
                libelle="Période"
                className="h-8"
                value={periode}
                onChange={(range) => {
                  setPeriode(range);
                  setPage(PAGINATION.PAGE_PAR_DEFAUT);
                }}
              />
              {periode?.from ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-8"
                  title="Effacer la période"
                  aria-label="Effacer la période"
                  onClick={() => {
                    setPeriode(undefined);
                    setPage(PAGINATION.PAGE_PAR_DEFAUT);
                  }}
                >
                  <X className="size-3.5" />
                </Button>
              ) : null}
            </div>
          </div>
          {/* max-h uniquement comme plafond viewport : pas de scroll si le contenu tient. */}
          <CommandList className="mt-1 max-h-[min(24rem,calc(100vh-16rem))]">
            {!chargementListe && groupes.length === 0 ? (
              <CommandEmpty>
                <span className="flex flex-col items-center gap-1.5 text-muted-foreground">
                  <CalendarDays className="size-5" />
                  {filtreActif
                    ? "Aucune journée ne correspond à ces critères."
                    : "Aucune journée précédente."}
                </span>
              </CommandEmpty>
            ) : null}

            {groupes.map((groupe) => (
              <CommandGroup key={groupe.mois} heading={groupe.mois}>
                {groupe.journees.map(({ journee: j, iso }) => {
                  const etatItem =
                    ETAT_JOURNEE[j.etat] ?? ETAT_JOURNEE.brouillon;
                  const selectionnee = reference === j.reference;
                  return (
                    <CommandItem
                      key={j.reference}
                      value={j.reference}
                      onSelect={() => choisir(j.reference)}
                      className={CLASSE_ITEM}
                      style={selectionnee ? styleSelection : undefined}
                      aria-current={selectionnee ? "true" : undefined}
                    >
                      <TuileDate
                        iso={iso}
                        active={selectionnee}
                        couleur={theme.topColor}
                        fond={theme.iconBg}
                      />
                      <span className="flex min-w-0 flex-1 flex-col">
                        <span className="truncate text-[13px] font-semibold capitalize">
                          {jourLong(iso)}
                        </span>
                        <span className="truncate font-mono text-[11px] text-muted-foreground">
                          {j.reference}
                        </span>
                      </span>
                      <span className="flex shrink-0 flex-col items-end gap-1">
                        <span className="flex items-center gap-1">
                          {j.reouverte ? <BadgeReouverte /> : null}
                          <Badge className={etatItem.badge}>
                            {etatItem.label}
                          </Badge>
                        </span>
                        {selectionnee ? marqueSelection : null}
                      </span>
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            ))}

            {chargementListe ? (
              <div className="flex items-center justify-center gap-2 py-4 text-[12px] text-muted-foreground">
                <Loader2 className="size-4 animate-spin" />
                Chargement des journées…
              </div>
            ) : null}
          </CommandList>
        </Command>

        {total > 0 || chargementListe ? (
          <div className="flex items-center justify-between gap-2 border-t px-3 py-2">
            <p className="text-[11px] tabular-nums text-muted-foreground">
              {chargementListe
                ? "Chargement…"
                : `${total} journée${total > 1 ? "s" : ""}`}
              {!chargementListe && pages > 1
                ? ` · page ${page}/${pages}`
                : null}
            </p>
            {pages > 1 ? (
              <div className="flex items-center gap-0.5">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-7"
                  disabled={chargementListe || page <= 1}
                  aria-label="Page précédente"
                  onClick={() => allerPage(page - 1)}
                >
                  <ChevronLeft className="size-4" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-7"
                  disabled={chargementListe || page >= pages}
                  aria-label="Page suivante"
                  onClick={() => allerPage(page + 1)}
                >
                  <ChevronRight className="size-4" />
                </Button>
              </div>
            ) : null}
          </div>
        ) : null}
      </PopoverContent>
    </Popover>
  );
}

import { useEffect, useState, type ElementType } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowRightLeft, Banknote, Link2, CheckCheck, ChevronLeft, ChevronRight, FilterX, Loader2, Pencil,
  Search, Undo2,
} from "lucide-react";
import { toast } from "sonner";
import { PAGINATION } from "@/shared/config/app";
import { getPortalMenu } from "@/shared/config/menu";
import { messageDonneesOuDefaut } from "@/shared/lib/message-utilisateur";
import { formatMontant } from "@/shared/lib/format";
import { optionsTaillePagination } from "@/shared/lib/pagination";
import { Badge } from "@/shared/components/ui/badge";
import { Button } from "@/shared/components/ui/button";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from "@/shared/components/ui/dialog";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/shared/components/ui/input-group";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/shared/components/ui/select";
import { cn } from "@/shared/lib/utils";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/shared/components/ui/table";
import {
  listerDatesOuvertureBeac,
  listerRecettesBeac,
} from "@/portails/Sp/api/operations-beac";
import {
  recettesJourValidees,
  validerRecettesJour,
} from "@/portails/Sp/api/journees-tresorerie";
import {
  CLASSE_LIGNE_RAPPROCHEE,
  depuisCentimes,
  filtrerRecettes,
  formaterDateHeure,
  paginerLocal,
  titreRapprochement,
  totalCentimes,
} from "@/portails/Sp/components/rapprochement/rapprochement";
import type {
  DateOuverture,
  RecetteBeac,
} from "@/portails/Sp/types/operations-jour.interface";
import type {
  RecetteValidee, RecettesJourValidees,
} from "@/portails/Sp/types/journee-tresorerie.interface";

const PAGE_SIZE_OPTIONS = optionsTaillePagination()
  .filter((option) => option.value === "all" || Number(option.value) >= PAGINATION.TAILLE_PAR_DEFAUT)
  .map((option) => (option.value === "all" ? { ...option, label: "Tous" } : option));

function formaterMontant(valeur: string): string {
  const formate = formatMontant(valeur);
  return formate === "—" ? valeur : formate;
}

function libelleDate(date: DateOuverture): string {
  const jour = date.date_ouverture ?? "—";
  const extra = [date.libelle, date.code].filter(Boolean).join(" · ");
  return extra ? `${jour} — ${extra}` : jour;
}

function numerosPages(page: number, totalPages: number): number[] {
  const fenetre = 5;
  const debut = Math.max(1, Math.min(page - 2, totalPages - fenetre + 1));
  const fin = Math.min(totalPages, debut + fenetre - 1);
  return Array.from({ length: fin - debut + 1 }, (_, i) => debut + i);
}

type FiltreRapprochement = "" | "rapprochees" | "non_rapprochees";

function filtrerParRapprochement(
  recettes: RecetteValidee[],
  filtre: FiltreRapprochement,
): RecetteValidee[] {
  if (filtre === "rapprochees") return recettes.filter((r) => r.rapprochement != null);
  if (filtre === "non_rapprochees") return recettes.filter((r) => r.rapprochement == null);
  return recettes;
}

function originesDe(recettes: RecetteBeac[]): string[] {
  return [...new Set(recettes.map((r) => r.origine).filter(Boolean))].sort();
}

interface ContenuRecettesJourProps {
  /** Charge les données lorsque le panneau devient visible (dialog ouvert, onglet actif). */
  actif: boolean;
  /** Dialog : bouton « Fermer » + fermeture avant d'aller au rapprochement. */
  onClose?: () => void;
  /** Journée qui porte la liste validée et le rapprochement. */
  referenceJournee?: string;
  /** Journée clôturée : la liste validée ne peut plus être remplacée. */
  lectureSeule?: boolean;
  /** Rendu dans une page (onglet) plutôt que dans un dialog : hauteur naturelle, bloc encadré. */
  integre?: boolean;
  /** Notifie la liste validée de la journée (chargée ou nouvellement validée). */
  onValideeChange?: (validee: RecettesJourValidees | null) => void;
}

/**
 * Recettes du jour. Si la journée a déjà une liste validée, elle est affichée
 * directement ; sinon (ou via « Modifier »), on consulte Oracle par date
 * d'ouverture et « Valider » fige la liste pour la journée.
 * Partagé par le dialog « Recettes du jour » et l'onglet Recettes de la journée.
 */
export function ContenuRecettesJour({
  actif,
  onClose,
  referenceJournee,
  lectureSeule = false,
  integre = false,
  onValideeChange,
}: ContenuRecettesJourProps) {
  const navigate = useNavigate();
  const theme = getPortalMenu("sp").theme;
  const [validee, setValidee] = useState<RecettesJourValidees | null>(null);
  const [chargementValidee, setChargementValidee] = useState(false);
  /** true : consultation Oracle ; false : affichage de la liste validée. */
  const [modeOracle, setModeOracle] = useState(false);
  const [validation, setValidation] = useState(false);
  const [dates, setDates] = useState<DateOuverture[]>([]);
  const [dateChoisie, setDateChoisie] = useState<string>("");
  const [chargementDates, setChargementDates] = useState(false);
  const [chargementRecettes, setChargementRecettes] = useState(false);
  const [operations, setOperations] = useState<RecetteBeac[]>([]);
  const [total, setTotal] = useState("0.00");
  const [nombre, setNombre] = useState(0);
  const [pages, setPages] = useState(1);
  const [origines, setOrigines] = useState<string[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [origine, setOrigine] = useState("");
  /** Liste validée uniquement : rapprochées / non rapprochées avec la Fiche d'exécution. */
  const [filtreRappro, setFiltreRappro] = useState<FiltreRapprochement>("");
  const [page, setPage] = useState<number>(PAGINATION.PAGE_PAR_DEFAUT);
  const [pageSize, setPageSize] = useState(String(PAGINATION.TAILLE_PAR_DEFAUT));

  useEffect(() => {
    const t = window.setTimeout(() => {
      setDebouncedSearch(search.trim());
      setPage(1);
    }, 350);
    return () => window.clearTimeout(t);
  }, [search]);

  // Ouverture : réinitialise, puis cherche la liste déjà validée pour la journée.
  useEffect(() => {
    if (!actif) return;
    let annule = false;
    setValidee(null);
    setModeOracle(false);
    setDates([]);
    setDateChoisie("");
    setOperations([]);
    setTotal("0.00");
    setNombre(0);
    setPages(1);
    setOrigines([]);
    setMessage(null);
    setSearch("");
    setDebouncedSearch("");
    setOrigine("");
    setFiltreRappro("");
    setPage(PAGINATION.PAGE_PAR_DEFAUT);
    setPageSize(String(PAGINATION.TAILLE_PAR_DEFAUT));
    if (!referenceJournee) {
      setModeOracle(true);
      return;
    }
    setChargementValidee(true);
    void recettesJourValidees(referenceJournee)
      .then(({ recettes_jour }) => {
        if (annule) return;
        setValidee(recettes_jour);
        setModeOracle(recettes_jour == null);
        onValideeChange?.(recettes_jour);
      })
      .catch((e) => {
        if (annule) return;
        toast.error(messageDonneesOuDefaut(
          e instanceof Error ? e.message : null,
          "Impossible de charger la liste de recettes validée.",
        ));
        setModeOracle(true);
      })
      .finally(() => {
        if (!annule) setChargementValidee(false);
      });
    return () => {
      annule = true;
    };
  }, [actif, referenceJournee, onValideeChange]);

  useEffect(() => {
    if (!actif || !modeOracle) return;
    let annule = false;
    setChargementDates(true);
    void listerDatesOuvertureBeac()
      .then((payload) => {
        if (annule) return;
        const liste = (payload.dates ?? []).filter((d) => d.date_ouverture);
        setDates(liste);
        setDateChoisie(liste[0]?.date_ouverture ?? "");
        if (liste.length === 0) {
          setMessage(payload.message ?? "Aucune date d'ouverture disponible.");
        }
      })
      .catch((e) => {
        if (annule) return;
        const texte = messageDonneesOuDefaut(
          e instanceof Error ? e.message : null,
          "Impossible de charger les dates d'ouverture.",
        );
        setMessage(texte);
        toast.error(texte);
      })
      .finally(() => {
        if (!annule) setChargementDates(false);
      });
    return () => {
      annule = true;
    };
  }, [actif, modeOracle]);

  useEffect(() => {
    if (!actif || !modeOracle || dateChoisie === "") return;
    let annule = false;
    setChargementRecettes(true);
    void listerRecettesBeac({
      date: dateChoisie,
      q: debouncedSearch || undefined,
      origine: origine || undefined,
      page,
      limite: pageSize === "all" ? "all" : Number(pageSize),
    })
      .then((payload) => {
        if (annule) return;
        setOperations(payload.operations ?? []);
        setTotal(payload.total ?? "0.00");
        setNombre(payload.nombre ?? 0);
        setPages(Math.max(1, payload.pages ?? 1));
        setOrigines(payload.origines ?? []);
        setMessage(payload.message);
        if (payload.page != null && payload.page !== page) {
          setPage(payload.page);
        }
      })
      .catch((e) => {
        if (annule) return;
        const texte = messageDonneesOuDefaut(
          e instanceof Error ? e.message : null,
          "Impossible de charger les recettes.",
        );
        setOperations([]);
        setNombre(0);
        setPages(1);
        setMessage(texte);
        toast.error(texte);
      })
      .finally(() => {
        if (!annule) setChargementRecettes(false);
      });
    return () => {
      annule = true;
    };
  }, [actif, modeOracle, dateChoisie, debouncedSearch, origine, page, pageSize]);

  // Liste validée : filtres et pagination côté client.
  const afficheValidee = !modeOracle && validee != null;
  const filtreesValidee = afficheValidee
    ? filtrerParRapprochement(
        filtrerRecettes(validee.recettes, debouncedSearch, origine),
        filtreRappro,
      )
    : [];
  const nombreRapprochees = afficheValidee
    ? validee.recettes.filter((r) => r.rapprochement != null).length
    : 0;
  const pageValidee = paginerLocal(filtreesValidee, page, pageSize);
  const lignes = afficheValidee ? pageValidee.lignes : operations;
  const totalAffiche = afficheValidee ? depuisCentimes(totalCentimes(filtreesValidee)) : total;
  const nombreAffiche = afficheValidee ? filtreesValidee.length : nombre;
  const pagesAffichees = afficheValidee ? pageValidee.pages : pages;
  const pageAffichee = afficheValidee ? pageValidee.page : page;
  const originesListe = afficheValidee ? originesDe(validee.recettes) : origines;
  const messageAffiche = afficheValidee
    ? (validee.recettes.length > 0 ? "Aucune recette ne correspond aux filtres." : "La liste validée est vide.")
    : message;

  const originesSelect = origine && !originesListe.includes(origine)
    ? [...originesListe, origine]
    : originesListe;
  const chargementGlobal = chargementValidee || (modeOracle && chargementDates);
  const premiereCharge = chargementGlobal || (modeOracle && chargementRecettes && operations.length === 0);
  const filtresActifs = Boolean(search.trim() || origine || (afficheValidee && filtreRappro));
  const filtresDesactives = chargementGlobal || (modeOracle && dateChoisie === "");

  function reinitialiserFiltres() {
    setSearch("");
    setDebouncedSearch("");
    setOrigine("");
    setFiltreRappro("");
    setPage(PAGINATION.PAGE_PAR_DEFAUT);
  }

  function changerMode(oracle: boolean) {
    reinitialiserFiltres();
    setModeOracle(oracle);
  }

  function ouvrirRapprochement() {
    if (!referenceJournee) return;
    onClose?.();
    void navigate(
      `/sp/fiche-matinale/rapprochement-recettes/${encodeURIComponent(referenceJournee)}`,
    );
  }

  async function valider() {
    if (!referenceJournee || dateChoisie === "" || validation) return;
    setValidation(true);
    try {
      const { recettes_jour } = await validerRecettesJour(referenceJournee, dateChoisie);
      setValidee(recettes_jour);
      setModeOracle(false);
      onValideeChange?.(recettes_jour);
      toast.success(
        `Liste validée : ${recettes_jour.nombre} recette${recettes_jour.nombre > 1 ? "s" : ""} du ${recettes_jour.date_ouverture}.`,
      );
    } catch (e) {
      toast.error(messageDonneesOuDefaut(
        e instanceof Error ? e.message : null,
        "Impossible de valider la liste de recettes.",
      ));
    } finally {
      setValidation(false);
    }
  }

  // Dans un dialog, titre et description passent par Radix (accessibilité).
  const Titre: ElementType = integre ? "p" : DialogTitle;
  const Description: ElementType = integre ? "p" : DialogDescription;
  const Entete: ElementType = integre ? "div" : DialogHeader;
  const px = integre ? "px-4" : "px-6";

  return (
    <div
      className={cn(
        "flex flex-col",
        integre ? "overflow-hidden rounded-xl border bg-card" : "min-h-0 flex-1",
      )}
    >
        <Entete
          className={cn(
            "flex shrink-0 flex-col gap-1 border-b text-left",
            integre ? "bg-muted/30 px-4 py-3" : "px-6 py-4 pr-12",
          )}
        >
          <div className="flex items-center gap-2">
            <Titre className={integre ? "text-[14px] font-semibold text-foreground" : undefined}>
              Recettes du jour
            </Titre>
            {afficheValidee ? (
              <Badge className="gap-1 border-transparent bg-emerald-600 text-[10px] font-semibold uppercase tracking-wide text-white">
                <CheckCheck className="size-3" />
                Validée
              </Badge>
            ) : null}
          </div>
          <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
            <Description className="min-w-0 text-sm text-muted-foreground">
              {afficheValidee ? (
                <>
                  Liste du <span className="font-medium text-foreground">{validee.date_ouverture}</span>{" "}
                  validée le {formaterDateHeure(validee.validee_le)}
                  {validee.validee_par ? <> par <span className="font-medium text-foreground">{validee.validee_par}</span></> : null}
                  {" "}· {validee.nombre} recette{validee.nombre > 1 ? "s" : ""}
                  {" "}·{" "}
                  <span className="inline-flex items-center gap-1 font-medium text-emerald-700">
                    <Link2 className="size-3.5" />
                    {nombreRapprochees} rapprochée{nombreRapprochees > 1 ? "s" : ""}
                  </span>
                  .
                </>
              ) : validee ? (
                "Choisissez une autre date d'ouverture : « Valider » remplacera la liste validée."
              ) : (
                "Sélectionnez une date d'ouverture, puis validez les recettes Oracle de la journée."
              )}
            </Description>
            {referenceJournee ? (
              <div className="flex shrink-0 items-center gap-2">
                {afficheValidee ? (
                  <>
                    {!lectureSeule ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="h-8 gap-1.5"
                        onClick={() => changerMode(true)}
                        title="Choisir une autre date d'ouverture et revalider"
                      >
                        <Pencil className="size-3.5" />
                        Modifier
                      </Button>
                    ) : null}
                    <Button
                      type="button"
                      size="sm"
                      className="h-8 gap-1.5 text-white hover:opacity-90"
                      style={{ background: theme.ctaColor }}
                      onClick={ouvrirRapprochement}
                      title="Rapprocher ces recettes avec la fiche d'exécution"
                    >
                      <ArrowRightLeft className="size-3.5" />
                      Rapprochement
                    </Button>
                  </>
                ) : (
                  <>
                    {validee ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="h-8 gap-1.5"
                        onClick={() => changerMode(false)}
                        disabled={validation}
                      >
                        <Undo2 className="size-3.5" />
                        Annuler
                      </Button>
                    ) : null}
                    {!lectureSeule ? (
                      <Button
                        type="button"
                        size="sm"
                        className="h-8 gap-1.5 text-white hover:opacity-90"
                        style={{ background: theme.ctaColor }}
                        disabled={chargementGlobal || dateChoisie === "" || validation}
                        onClick={() => void valider()}
                        title="Figer les recettes de cette date pour la journée"
                      >
                        {validation ? (
                          <Loader2 className="size-3.5 animate-spin" />
                        ) : (
                          <CheckCheck className="size-3.5" />
                        )}
                        Valider
                      </Button>
                    ) : null}
                  </>
                )}
              </div>
            ) : null}
          </div>
        </Entete>

        <div className={cn("flex shrink-0 flex-wrap items-end justify-between gap-3 border-b py-3", px)}>
          <div className="flex min-w-0 flex-wrap items-end gap-3">
            <div className="min-w-[14rem] space-y-1">
              <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                Date d&apos;ouverture
              </p>
              {afficheValidee ? (
                <p className="flex h-8 items-center rounded-md border bg-muted/40 px-3 text-[13px] font-medium tabular-nums">
                  {validee.date_ouverture}
                </p>
              ) : (
                <Select
                  value={dateChoisie}
                  onValueChange={(valeur) => {
                    setDateChoisie(valeur);
                    setOrigine("");
                    setPage(1);
                    setOperations([]);
                    setOrigines([]);
                    setNombre(0);
                    setTotal("0.00");
                  }}
                  disabled={chargementGlobal || dates.length === 0}
                >
                  <SelectTrigger className="h-8 w-[22rem] max-w-full">
                    <SelectValue placeholder="Choisir une date…" />
                  </SelectTrigger>
                  <SelectContent>
                    {dates.map((date) => (
                      <SelectItem
                        key={`${date.date_ouverture}-${date.n_session ?? ""}`}
                        value={date.date_ouverture ?? ""}
                      >
                        {libelleDate(date)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
            <div className="space-y-1">
              <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                Recherche
              </p>
              <InputGroup className="h-8 w-64 bg-background">
                <InputGroupAddon>
                  <Search className="size-3.5" />
                </InputGroupAddon>
                <InputGroupInput
                  placeholder="Origine, référence, tiers…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  disabled={filtresDesactives}
                />
              </InputGroup>
            </div>
            <div className="space-y-1">
              <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                Origine
              </p>
              <Select
                value={origine || "all"}
                onValueChange={(valeur) => {
                  setOrigine(valeur === "all" ? "" : valeur);
                  setPage(1);
                }}
                disabled={filtresDesactives}
              >
                <SelectTrigger className="h-8 w-[11rem]">
                  <SelectValue placeholder="Toutes" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Toutes</SelectItem>
                  {originesSelect.map((valeur) => (
                    <SelectItem key={valeur} value={valeur}>{valeur}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {afficheValidee ? (
              <div className="space-y-1">
                <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                  Rapprochement
                </p>
                <Select
                  value={filtreRappro || "all"}
                  onValueChange={(valeur) => {
                    setFiltreRappro(valeur === "all" ? "" : (valeur as FiltreRapprochement));
                    setPage(1);
                  }}
                >
                  <SelectTrigger className="h-8 w-[11rem]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Toutes</SelectItem>
                    <SelectItem value="rapprochees">Rapprochées</SelectItem>
                    <SelectItem value="non_rapprochees">Non rapprochées</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            ) : null}
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 gap-1.5"
              onClick={reinitialiserFiltres}
              disabled={!filtresActifs || filtresDesactives}
              title="Réinitialiser la recherche et les filtres"
            >
              <FilterX className="size-3.5" />
              Réinitialiser
            </Button>
          </div>
          <div className="text-right">
            <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              Total recettes
            </p>
            <p
              className="text-[15px] font-bold tabular-nums"
              style={{ color: theme.iconColor }}
            >
              {formaterMontant(totalAffiche)} FCFA
            </p>
          </div>
        </div>

        <div className={cn("py-4", px, !integre && "min-h-0 flex-1 overflow-y-auto")}>
          {premiereCharge ? (
            <div className="flex min-h-[200px] items-center justify-center gap-2 text-muted-foreground">
              <Loader2 className="size-5 animate-spin" />
              Chargement…
            </div>
          ) : lignes.length === 0 ? (
            <div className="flex min-h-[200px] flex-col items-center justify-center gap-2 text-center">
              <Banknote className="size-6 text-muted-foreground" />
              <p className="text-[13.5px] text-muted-foreground">
                {messageAffiche ?? "Aucune recette."}
              </p>
            </div>
          ) : (
            <div className="relative">
              {modeOracle && chargementRecettes ? (
                <div className="absolute inset-0 z-10 flex items-center justify-center rounded-xl bg-background/60">
                  <Loader2 className="size-5 animate-spin text-muted-foreground" />
                </div>
              ) : null}
              <Table containerClassName="overflow-visible rounded-xl border">
                <TableHeader>
                  <TableRow className="bg-muted/40 hover:bg-muted/40">
                    <TableHead className="w-px whitespace-nowrap">Origine</TableHead>
                    <TableHead className="w-px whitespace-nowrap">Réception</TableHead>
                    <TableHead className="w-px whitespace-nowrap">Validation</TableHead>
                    <TableHead className="w-px whitespace-nowrap">Référence</TableHead>
                    <TableHead className="w-px whitespace-nowrap">N° règlement</TableHead>
                    <TableHead className="w-full">Tiers</TableHead>
                    <TableHead className="w-px whitespace-nowrap text-right">Montant</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {lignes.map((op, index) => {
                    const rapprochement = afficheValidee
                      ? (op as RecetteValidee).rapprochement
                      : undefined;
                    return (
                    <TableRow
                      key={`${op.reference ?? "r"}-${op.num_reglement ?? index}`}
                      className={rapprochement ? CLASSE_LIGNE_RAPPROCHEE : undefined}
                      title={titreRapprochement(rapprochement)}
                    >
                      <TableCell className="w-px whitespace-nowrap font-medium">{op.origine || "—"}</TableCell>
                      <TableCell className="w-px whitespace-nowrap tabular-nums">{op.date_reception ?? "—"}</TableCell>
                      <TableCell className="w-px whitespace-nowrap tabular-nums">{op.date_validation ?? "—"}</TableCell>
                      <TableCell className="w-px whitespace-nowrap tabular-nums">{op.reference ?? "—"}</TableCell>
                      <TableCell className="w-px whitespace-nowrap tabular-nums">{op.num_reglement ?? "—"}</TableCell>
                      <TableCell className="min-w-0 whitespace-normal">{op.libelle_tiers ?? "—"}</TableCell>
                      <TableCell className="w-px whitespace-nowrap text-right font-semibold tabular-nums">
                        {formaterMontant(op.montant)}
                      </TableCell>
                    </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </div>

        <div className={cn("flex shrink-0 flex-wrap items-center justify-between gap-3 border-t bg-muted/50 py-3", px, !integre && "rounded-b-xl")}>
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <p className="text-xs text-muted-foreground">Lignes par page</p>
              <Select
                value={pageSize}
                onValueChange={(valeur) => {
                  setPageSize(valeur);
                  setPage(1);
                }}
                disabled={filtresDesactives}
              >
                <SelectTrigger className="h-8 w-[84px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PAGE_SIZE_OPTIONS.map(({ value, label }) => (
                    <SelectItem key={value} value={value}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <p className="text-xs text-muted-foreground">
              {nombreAffiche} recette{nombreAffiche !== 1 ? "s" : ""}
            </p>
            {pagesAffichees > 1 ? (
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  disabled={pageAffichee === 1 || chargementRecettes}
                  onClick={() => setPage(Math.max(1, pageAffichee - 1))}
                >
                  <ChevronLeft className="size-4" />
                </Button>
                {numerosPages(pageAffichee, pagesAffichees).map((numero) => (
                  <Button
                    key={numero}
                    variant={pageAffichee === numero ? "default" : "ghost"}
                    size="icon"
                    disabled={chargementRecettes}
                    onClick={() => setPage(numero)}
                  >
                    {numero}
                  </Button>
                ))}
                <Button
                  variant="ghost"
                  size="icon"
                  disabled={pageAffichee === pagesAffichees || chargementRecettes}
                  onClick={() => setPage(Math.min(pagesAffichees, pageAffichee + 1))}
                >
                  <ChevronRight className="size-4" />
                </Button>
              </div>
            ) : null}
          </div>
          {onClose ? (
            <Button type="button" variant="outline" onClick={onClose}>
              Fermer
            </Button>
          ) : null}
        </div>
    </div>
  );
}

interface DialogRecettesOracleProps {
  ouvert: boolean;
  onClose: () => void;
  /** Journée qui porte la liste validée et le rapprochement. */
  referenceJournee?: string;
  /** Journée clôturée : la liste validée ne peut plus être remplacée. */
  lectureSeule?: boolean;
}

export function DialogRecettesOracle({
  ouvert,
  onClose,
  referenceJournee,
  lectureSeule = false,
}: DialogRecettesOracleProps) {
  return (
    <Dialog open={ouvert} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="flex max-h-[calc(100dvh-2rem)] w-[min(96vw,80rem)] flex-col gap-0 overflow-hidden p-0 sm:max-w-[80rem]">
        <ContenuRecettesJour
          actif={ouvert}
          onClose={onClose}
          referenceJournee={referenceJournee}
          lectureSeule={lectureSeule}
        />
      </DialogContent>
    </Dialog>
  );
}

import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ChevronLeft, ChevronRight, Download, Eye, Inbox, Loader2, MoreVertical,
  Printer, Search, Trash2, X,
} from "lucide-react";
import { toast } from "sonner";
import type { DateRange } from "react-day-picker";
import { PAGINATION } from "@/shared/config/app";
import { optionsTaillePagination } from "@/shared/lib/pagination";
import {
  PeriodDatePicker,
  periodeVersIso,
} from "@/shared/components/date/PeriodDatePicker";
import { Badge } from "@/shared/components/ui/badge";
import { Button } from "@/shared/components/ui/button";
import {
  Card, CardContent, CardDescription, CardHeader, CardTitle,
} from "@/shared/components/ui/card";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/shared/components/ui/dropdown-menu";
import {
  Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle,
} from "@/shared/components/ui/empty";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/shared/components/ui/input-group";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/shared/components/ui/select";
import { Skeleton } from "@/shared/components/ui/skeleton";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/shared/components/ui/table";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/shared/components/ui/tooltip";
import {
  DialogChoixDocumentJournee,
  type DocumentJourneeChoix,
} from "@/portails/Sp/components/archives/DialogChoixDocumentJournee";
import { DialogSupprimerJournee } from "@/portails/Sp/components/archives/DialogSupprimerJournee";
import {
  ETAT_JOURNEE, libelleDateJournee,
} from "@/portails/Sp/components/archives/archives-affichage";
import {
  formaterDateHeureFr, formaterMontantFcfa,
} from "@/portails/Sp/components/fiche-bleue/fiche-bleue-affichage";
import { listerFichesDepotDeJournee } from "@/portails/Sp/api/fiches-depot";
import {
  listerJourneesTresorerie, supprimerJourneeTresorerie,
} from "@/portails/Sp/api/journees-tresorerie";
import {
  imprimerFicheBleueSp,
  imprimerFicheExecutionSp,
  imprimerFichesDepotSp,
  telechargerTousDocumentsJournee,
} from "@/portails/Sp/lib/documents-journee";
import { useJourneeSelectionnee } from "@/portails/Sp/hooks/journee-selectionnee";
import type { EtatJournee, JourneeTresorerie } from "@/portails/Sp/types/journee-tresorerie.interface";

const PAGE_SIZE_OPTIONS = optionsTaillePagination();

function numerosPages(page: number, totalPages: number): number[] {
  const fenetre = 5;
  const debut = Math.max(1, Math.min(page - 2, totalPages - fenetre + 1));
  const fin = Math.min(totalPages, debut + fenetre - 1);
  return Array.from({ length: fin - debut + 1 }, (_, i) => debut + i);
}

const ETATS_FILTRE: { valeur: EtatJournee; label: string }[] = [
  { valeur: "brouillon", label: "Brouillon" },
  { valeur: "en_cours", label: "En cours" },
  { valeur: "cloture", label: "Clôturée" },
];

export function VueListeJournees({ maquette = false }: { maquette?: boolean }) {
  const navigate = useNavigate();
  const { journee: journeeSelectionnee, selectionner } = useJourneeSelectionnee();
  const [journees, setJournees] = useState<JourneeTresorerie[]>([]);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState(false);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [filterEtat, setFilterEtat] = useState<EtatJournee | "">("");
  const [periode, setPeriode] = useState<DateRange | undefined>();
  const [page, setPage] = useState<number>(PAGINATION.PAGE_PAR_DEFAUT);
  const [pageSize, setPageSize] = useState(String(PAGINATION.TAILLE_PAR_DEFAUT));
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [aSupprimer, setASupprimer] = useState<JourneeTresorerie | null>(null);
  const [suppressionEnCours, setSuppressionEnCours] = useState(false);
  const [aImprimer, setAImprimer] = useState<JourneeTresorerie | null>(null);
  const [actionEnCours, setActionEnCours] = useState<string | null>(null);

  useEffect(() => {
    const t = window.setTimeout(() => {
      setDebouncedSearch(search.trim());
      setPage(1);
    }, 350);
    return () => window.clearTimeout(t);
  }, [search]);

  const charger = useCallback(() => {
    setChargement(true);
    setErreur(false);
    const { dateDebut, dateFin } = periodeVersIso(periode);
    return listerJourneesTresorerie({
      page,
      limite: pageSize === "all" ? "all" : Number(pageSize),
      q: debouncedSearch || undefined,
      etat: filterEtat || undefined,
      date_debut: dateDebut || undefined,
      date_fin: dateFin || undefined,
    })
      .then((data) => {
        setJournees(data.journees ?? []);
        setTotal(data.total ?? 0);
        setTotalPages(Math.max(1, data.pages ?? 1));
      })
      .catch((e) => {
        setErreur(true);
        toast.error(
          e instanceof Error ? e.message : "Impossible de charger les journées de trésorerie.",
        );
      })
      .finally(() => setChargement(false));
  }, [page, pageSize, debouncedSearch, filterEtat, periode]);

  useEffect(() => {
    let actif = true;
    Promise.resolve().then(() => {
      if (actif) void charger();
    });
    return () => {
      actif = false;
    };
  }, [charger]);

  const hasActiveFilters = Boolean(search || filterEtat || periode?.from);

  function resetFiltres() {
    setSearch("");
    setDebouncedSearch("");
    setFilterEtat("");
    setPeriode(undefined);
    setPage(1);
  }

  async function confirmerSuppression() {
    if (!aSupprimer) return;
    setSuppressionEnCours(true);
    try {
      await supprimerJourneeTresorerie(aSupprimer.reference);
      toast.success("Journée de trésorerie supprimée.");
      if (aSupprimer.reference === journeeSelectionnee?.reference) {
        selectionner(null);
      }
      setASupprimer(null);
      await charger();
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : "Impossible de supprimer la journée.",
      );
    } finally {
      setSuppressionEnCours(false);
    }
  }

  function aDesDocuments(j: JourneeTresorerie): boolean {
    return (
      j.fiche_bleue_id != null
      || (j.nombre_fiches_depot ?? 0) > 0
      || j.fiche_execution_id != null
    );
  }

  async function executerAction(
    cle: string,
    action: () => Promise<void>,
    succes: string,
  ) {
    if (actionEnCours) return;
    setActionEnCours(cle);
    try {
      await action();
      toast.success(succes);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Action impossible.");
    } finally {
      setActionEnCours(null);
    }
  }

  async function imprimerDocumentChoisi(
    journee: JourneeTresorerie,
    choix: DocumentJourneeChoix,
  ) {
    if (choix.type === "bleue") {
      await imprimerFicheBleueSp(choix.id);
      return;
    }
    if (choix.type === "execution") {
      await imprimerFicheExecutionSp(choix.id);
      return;
    }
    const refs =
      choix.references.length > 0
        ? choix.references
        : ((await listerFichesDepotDeJournee(journee.reference)).fiches ?? []).map(
            (f) => f.reference,
          );
    await imprimerFichesDepotSp(refs);
  }

  async function telechargerJournee(j: JourneeTresorerie) {
    const page = await listerFichesDepotDeJournee(j.reference);
    await telechargerTousDocumentsJournee({
      journee: j,
      depots: page.fiches ?? [],
    });
  }

  return (
    <TooltipProvider>
      <Card className={`gap-0 overflow-hidden py-0${maquette ? " border-0 shadow-none" : ""}`}>
        <CardHeader className="flex flex-col items-stretch gap-3 border-b py-4">
          {!maquette ? (
          <div>
            <CardTitle>Toutes les journées</CardTitle>
            <CardDescription>
              {chargement ? "Chargement…" : `${total} journée${total !== 1 ? "s" : ""}`}
            </CardDescription>
          </div>
          ) : null}
          <div className="flex w-full min-w-0 flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
            <InputGroup className="h-9 w-full bg-background sm:w-64">
              <InputGroupAddon>
                <Search className="size-3.5" />
              </InputGroupAddon>
              <InputGroupInput
                placeholder="Référence, fiche bleue, exécution…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </InputGroup>
            <Select
              value={filterEtat || "all"}
              onValueChange={(v) => {
                setFilterEtat(v === "all" ? "" : (v as EtatJournee));
                setPage(1);
              }}
            >
              <SelectTrigger className="w-full sm:w-[150px]">
                <SelectValue placeholder="Tous les états" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous les états</SelectItem>
                {ETATS_FILTRE.map((s) => (
                  <SelectItem key={s.valeur} value={s.valeur}>{s.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {hasActiveFilters ? (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="destructive" size="icon" onClick={resetFiltres}>
                    <X className="size-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Réinitialiser les filtres</TooltipContent>
              </Tooltip>
            ) : null}
            <PeriodDatePicker
              portail="sp"
              variant="filtre"
              libelle="Période"
              className="sm:ml-auto"
              value={periode}
              onChange={(range) => {
                setPeriode(range);
                setPage(1);
              }}
            />
          </div>
        </CardHeader>

        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="border-b-2 border-b-primary/20 bg-muted/60 hover:bg-muted/60">
                <TableHead className="h-11 text-[11px] font-bold uppercase tracking-wider">Référence</TableHead>
                <TableHead className="h-11 text-[11px] font-bold uppercase tracking-wider">Date</TableHead>
                <TableHead className="h-11 text-[11px] font-bold uppercase tracking-wider">Création</TableHead>
                <TableHead className="h-11 text-[11px] font-bold uppercase tracking-wider">Fiche Bleue</TableHead>
                <TableHead className="h-11 text-[11px] font-bold uppercase tracking-wider">Dépôts</TableHead>
                <TableHead className="h-11 text-[11px] font-bold uppercase tracking-wider">Exécution</TableHead>
                <TableHead className="h-11 text-right text-[11px] font-bold uppercase tracking-wider">
                  Dépenses (FCFA)
                </TableHead>
                <TableHead className="h-11 text-[11px] font-bold uppercase tracking-wider">État</TableHead>
                <TableHead className="h-11 text-right text-[11px] font-bold uppercase tracking-wider">
                  Actions
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {chargement ? (
                Array.from({ length: 5 }).map((_, idx) => (
                  <TableRow key={idx}>
                    <TableCell><Skeleton className="h-4 w-36" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-28" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-10" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-28" /></TableCell>
                    <TableCell><Skeleton className="ml-auto h-4 w-24" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-20 rounded-full" /></TableCell>
                    <TableCell />
                  </TableRow>
                ))
              ) : erreur ? (
                <TableRow>
                  <TableCell colSpan={9} className="py-10">
                    <Empty>
                      <EmptyHeader>
                        <EmptyMedia variant="icon" className="bg-destructive/10 text-destructive">
                          <Inbox />
                        </EmptyMedia>
                        <EmptyTitle>Erreur de chargement</EmptyTitle>
                        <EmptyDescription>Veuillez rafraîchir la page.</EmptyDescription>
                      </EmptyHeader>
                    </Empty>
                  </TableCell>
                </TableRow>
              ) : journees.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="py-10">
                    <Empty>
                      <EmptyHeader>
                        <EmptyMedia variant="icon">
                          <Inbox />
                        </EmptyMedia>
                        <EmptyTitle>Aucune journée trouvée</EmptyTitle>
                        <EmptyDescription>
                          Essayez de modifier vos filtres de recherche.
                        </EmptyDescription>
                      </EmptyHeader>
                    </Empty>
                  </TableCell>
                </TableRow>
              ) : (
                journees.map((j) => {
                  const etat = ETAT_JOURNEE[j.etat] ?? ETAT_JOURNEE.brouillon;
                  return (
                    <TableRow
                      key={j.reference}
                      className="cursor-pointer"
                      onClick={() => void navigate(`/sp/fiche-matinale/journee/${j.reference}`)}
                    >
                      <TableCell className="font-mono font-semibold text-primary">
                        {j.reference}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {libelleDateJournee(j.reference)}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {formaterDateHeureFr(j.date_creation)}
                      </TableCell>
                      <TableCell className="font-mono text-[12.5px] text-muted-foreground">
                        {j.fiche_bleue_reference ?? "—"}
                      </TableCell>
                      <TableCell className="tabular-nums text-muted-foreground">
                        {j.nombre_fiches_depot ?? 0}
                      </TableCell>
                      <TableCell className="font-mono text-[12.5px] text-muted-foreground">
                        {j.fiche_execution_reference ?? "—"}
                      </TableCell>
                      <TableCell className="text-right font-semibold tabular-nums">
                        {formaterMontantFcfa(j.total_depenses)}
                      </TableCell>
                      <TableCell>
                        <Badge className={etat.badge}>{etat.label}</Badge>
                      </TableCell>
                      <TableCell
                        className="text-right"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="flex justify-end">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="size-8 text-primary hover:text-primary"
                                aria-label={`Actions sur ${j.reference}`}
                                disabled={actionEnCours === j.reference}
                              >
                                {actionEnCours === j.reference ? (
                                  <Loader2 className="size-4 animate-spin" />
                                ) : (
                                  <MoreVertical className="size-4" />
                                )}
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-48">
                              <DropdownMenuLabel>Actions</DropdownMenuLabel>
                              <DropdownMenuItem
                                onSelect={() =>
                                  void navigate(`/sp/fiche-matinale/journee/${j.reference}`)
                                }
                              >
                                <Eye className="size-4 text-accent" />
                                Détail
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                disabled={!aDesDocuments(j) || actionEnCours !== null}
                                onSelect={() => setAImprimer(j)}
                              >
                                <Printer className="size-4 text-warning" />
                                Imprimer
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                disabled={!aDesDocuments(j) || actionEnCours !== null}
                                onSelect={() => {
                                  void executerAction(
                                    j.reference,
                                    () => telechargerJournee(j),
                                    "Archive ZIP téléchargée.",
                                  );
                                }}
                              >
                                <Download className="size-4 text-primary" />
                                Télécharger
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                variant="destructive"
                                onSelect={() => setASupprimer(j)}
                              >
                                <Trash2 className="size-4" />
                                Supprimer
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>

        {!chargement && !erreur && total > 0 ? (
          <div className="flex items-center justify-between border-t px-4 py-3">
            <div className="flex items-center gap-2">
              <p className="text-xs text-muted-foreground">Lignes par page</p>
              <Select
                value={pageSize}
                onValueChange={(v) => {
                  setPageSize(v);
                  setPage(1);
                }}
              >
                <SelectTrigger className="h-8 w-[76px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PAGE_SIZE_OPTIONS.map(({ value, label }) => (
                    <SelectItem key={value} value={value}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {totalPages > 1 ? (
              <div className="flex items-center gap-4">
                <p className="text-xs text-muted-foreground">
                  Page {page} sur {totalPages}
                </p>
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    disabled={page === 1}
                    onClick={() => setPage((p) => p - 1)}
                  >
                    <ChevronLeft className="size-4" />
                  </Button>
                  {numerosPages(page, totalPages).map((numero) => (
                    <Button
                      key={numero}
                      variant={page === numero ? "default" : "ghost"}
                      size="icon"
                      onClick={() => setPage(numero)}
                    >
                      {numero}
                    </Button>
                  ))}
                  <Button
                    variant="ghost"
                    size="icon"
                    disabled={page === totalPages}
                    onClick={() => setPage((p) => p + 1)}
                  >
                    <ChevronRight className="size-4" />
                  </Button>
                </div>
              </div>
            ) : null}
          </div>
        ) : null}
      </Card>

      <DialogSupprimerJournee
        journee={aSupprimer}
        chargement={suppressionEnCours}
        onOpenChange={(ouvert) => { if (!ouvert) setASupprimer(null); }}
        onConfirmer={() => void confirmerSuppression()}
      />
      <DialogChoixDocumentJournee
        journee={aImprimer}
        ouvert={aImprimer !== null}
        onClose={() => setAImprimer(null)}
        onConfirmer={async (choix) => {
          if (!aImprimer) return;
          await imprimerDocumentChoisi(aImprimer, choix);
          toast.success("Impression lancée.");
        }}
      />
    </TooltipProvider>
  );
}

import { useCallback, useEffect, useState } from "react";
import {
  ChevronLeft, ChevronRight, FileSearch, Inbox, Search, X,
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
import { PreviewFicheDepotDialog } from "@/portails/Sp/components/fiche-matinale/PreviewFicheDepotDialog";
import {
  formaterMontantDepot, STATUT_FICHE_DEPOT,
} from "@/portails/Sp/components/fiche-depot/fiche-depot-affichage";
import { listerFichesDepot } from "@/portails/Sp/api/fiches-depot";
import type {
  FicheDepotResumeSp, StatutFicheDepotSp,
} from "@/portails/Sp/types/fiche-depot.interface";

const PAGE_SIZE_OPTIONS = optionsTaillePagination();

function numerosPages(page: number, totalPages: number): number[] {
  const fenetre = 5;
  const debut = Math.max(1, Math.min(page - 2, totalPages - fenetre + 1));
  const fin = Math.min(totalPages, debut + fenetre - 1);
  return Array.from({ length: fin - debut + 1 }, (_, i) => debut + i);
}

const STATUTS_FILTRE: { valeur: StatutFicheDepotSp; label: string }[] = [
  { valeur: "envoyee", label: "Envoyée" },
  { valeur: "recue", label: "Reçue" },
];

export function VueListeFichesDepot() {
  const [fiches, setFiches] = useState<FicheDepotResumeSp[]>([]);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState(false);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [filterStatut, setFilterStatut] = useState<StatutFicheDepotSp | "">("");
  const [periode, setPeriode] = useState<DateRange | undefined>();
  const [page, setPage] = useState<number>(PAGINATION.PAGE_PAR_DEFAUT);
  const [pageSize, setPageSize] = useState(String(PAGINATION.TAILLE_PAR_DEFAUT));
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [previewRef, setPreviewRef] = useState<string | null>(null);

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
    return listerFichesDepot({
      page,
      limite: pageSize === "all" ? "all" : Number(pageSize),
      q: debouncedSearch || undefined,
      statut: filterStatut || undefined,
      date_debut: dateDebut || undefined,
      date_fin: dateFin || undefined,
    })
      .then((data) => {
        setFiches(data.fiches ?? []);
        setTotal(data.total ?? 0);
        setTotalPages(Math.max(1, data.pages ?? 1));
      })
      .catch((e) => {
        setErreur(true);
        toast.error(
          e instanceof Error
            ? e.message
            : "Impossible de charger les fiches de dépôt.",
        );
      })
      .finally(() => setChargement(false));
  }, [page, pageSize, debouncedSearch, filterStatut, periode]);

  useEffect(() => {
    let actif = true;
    Promise.resolve().then(() => {
      if (actif) void charger();
    });
    return () => {
      actif = false;
    };
  }, [charger]);

  const hasActiveFilters = Boolean(search || filterStatut || periode?.from);

  function resetFiltres() {
    setSearch("");
    setDebouncedSearch("");
    setFilterStatut("");
    setPeriode(undefined);
    setPage(1);
  }

  return (
    <TooltipProvider>
      <Card className="gap-0 overflow-hidden py-0">
        <CardHeader className="flex flex-col items-stretch gap-3 border-b py-4">
          <div>
            <CardTitle>Toutes les fiches de dépôt</CardTitle>
            <CardDescription>
              {chargement
                ? "Chargement…"
                : `${total} fiche${total !== 1 ? "s" : ""} reçue${total !== 1 ? "s" : ""} du Service Règlement`}
            </CardDescription>
          </div>
          <div className="flex w-full flex-wrap items-center gap-2">
            <InputGroup className="h-9 w-64 bg-background">
              <InputGroupAddon>
                <Search className="size-3.5" />
              </InputGroupAddon>
              <InputGroupInput
                placeholder="Référence, générateur, journée…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </InputGroup>
            <Select
              value={filterStatut || "all"}
              onValueChange={(v) => {
                setFilterStatut(v === "all" ? "" : (v as StatutFicheDepotSp));
                setPage(1);
              }}
            >
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Tous les statuts" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous les statuts</SelectItem>
                {STATUTS_FILTRE.map((s) => (
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
              className="ml-auto"
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
                <TableHead className="h-11 text-[11px] font-bold uppercase tracking-wider">Présentation</TableHead>
                <TableHead className="h-11 text-[11px] font-bold uppercase tracking-wider">Création</TableHead>
                <TableHead className="h-11 text-[11px] font-bold uppercase tracking-wider">Générée par</TableHead>
                <TableHead className="h-11 text-[11px] font-bold uppercase tracking-wider">Journée</TableHead>
                <TableHead className="h-11 text-right text-[11px] font-bold uppercase tracking-wider">
                  Montant (FCFA)
                </TableHead>
                <TableHead className="h-11 text-[11px] font-bold uppercase tracking-wider">Statut</TableHead>
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
                    <TableCell><Skeleton className="h-4 w-28" /></TableCell>
                    <TableCell><Skeleton className="ml-auto h-4 w-24" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-20 rounded-full" /></TableCell>
                    <TableCell />
                  </TableRow>
                ))
              ) : erreur ? (
                <TableRow>
                  <TableCell colSpan={8} className="py-10">
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
              ) : fiches.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="py-10">
                    <Empty>
                      <EmptyHeader>
                        <EmptyMedia variant="icon">
                          <Inbox />
                        </EmptyMedia>
                        <EmptyTitle>Pas de données à afficher</EmptyTitle>
                        <EmptyDescription>
                          Aucune fiche de dépôt ne correspond à vos critères.
                        </EmptyDescription>
                      </EmptyHeader>
                    </Empty>
                  </TableCell>
                </TableRow>
              ) : (
                fiches.map((f) => {
                  const st = STATUT_FICHE_DEPOT[f.statut] ?? STATUT_FICHE_DEPOT.cree;
                  return (
                    <TableRow
                      key={f.reference}
                      className="cursor-pointer"
                      onClick={() => setPreviewRef(f.reference)}
                    >
                      <TableCell className="font-mono font-semibold text-primary">
                        {f.reference}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {f.date_presentation_libelle || f.date_presentation}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {f.date_creation}
                      </TableCell>
                      <TableCell className="text-muted-foreground">{f.genere_par}</TableCell>
                      <TableCell className="font-mono text-[12.5px] text-muted-foreground">
                        {f.journee_tresorerie_reference ?? "—"}
                      </TableCell>
                      <TableCell className="text-right font-semibold tabular-nums">
                        {formaterMontantDepot(f.montant_total)}
                      </TableCell>
                      <TableCell>
                        <Badge className={st.badge}>{st.label}</Badge>
                      </TableCell>
                      <TableCell
                        className="text-right"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => setPreviewRef(f.reference)}
                            >
                              <FileSearch className="size-4 text-blue-600" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Voir le détail</TooltipContent>
                        </Tooltip>
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

      <PreviewFicheDepotDialog
        reference={previewRef}
        onClose={() => setPreviewRef(null)}
      />
    </TooltipProvider>
  );
}

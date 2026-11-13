import { useCallback, useEffect, useState } from "react";
import {
  ChevronLeft, ChevronRight, Inbox, Loader2, Search, X,
} from "lucide-react";
import { toast } from "sonner";
import type { DateRange } from "react-day-picker";
import { PAGINATION } from "@/shared/config/app";
import { optionsTaillePagination } from "@/shared/lib/pagination";
import {
  PeriodDatePicker,
  periodeVersIso,
} from "@/shared/components/date/PeriodDatePicker";
import { Button } from "@/shared/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/shared/components/ui/select";
import { TooltipProvider } from "@/shared/components/ui/tooltip";
import { PreviewFicheDepotDialog } from "@/portails/Sp/components/fiche-matinale/PreviewFicheDepotDialog";
import {
  formaterMontantDepot,
  statutDepotMaquette,
} from "@/portails/Sp/components/fiche-depot/fiche-depot-affichage";
import { SpTag } from "@/portails/Sp/components/layout/SpTag";
import { listerFichesDepot } from "@/portails/Sp/api/fiches-depot";
import type {
  FicheDepotResumeSp,
  StatutFicheDepotSp,
} from "@/portails/Sp/types/fiche-depot.interface";

const PAGE_SIZE_OPTIONS = optionsTaillePagination();

const GRILLE =
  "190px 110px 140px minmax(160px, 1fr) 140px 160px 110px";

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

interface VueListeFichesDepotProps {
  /** Présentation Prototype v2 (carte blanche + grille). */
  maquette?: boolean;
}

export function VueListeFichesDepot({ maquette = false }: VueListeFichesDepotProps) {
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

  const compteur = chargement
    ? "Chargement…"
    : `${total} fiche${total !== 1 ? "s" : ""}`;

  return (
    <TooltipProvider>
      <div className="flex flex-col overflow-hidden rounded-lg border border-[#e2e8f0] bg-white">
        <div
          className="flex flex-wrap items-center justify-between gap-3 border-b border-[#e2e8f0]"
          style={{ padding: "12px 16px" }}
        >
          <div className="flex min-w-0 flex-nowrap items-center gap-2">
            <label className="flex h-9 w-[min(320px,100%)] shrink-0 items-center gap-2 rounded-md border border-[#cbd5e1] px-3 text-[#64748b]">
              <Search size={16} aria-hidden />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Référence, agent…"
                className="min-w-0 flex-1 border-0 bg-transparent text-sm text-[#0f172a] outline-none placeholder:text-[#94a3b8]"
              />
            </label>
            {maquette ? (
              <>
                <Select
                  value={filterStatut || "all"}
                  onValueChange={(v) => {
                    setFilterStatut(
                      v === "all" ? "" : (v as StatutFicheDepotSp),
                    );
                    setPage(1);
                  }}
                >
                  <SelectTrigger className="h-9 w-[150px] shrink-0 border-[#cbd5e1]">
                    <SelectValue placeholder="Tous les statuts" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Tous les statuts</SelectItem>
                    {STATUTS_FILTRE.map((s) => (
                      <SelectItem key={s.valeur} value={s.valeur}>
                        {s.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {hasActiveFilters ? (
                  <button
                    type="button"
                    onClick={resetFiltres}
                    className="flex h-9 shrink-0 items-center gap-1.5 rounded-md border border-[#fecaca] bg-[#fef2f2] px-2.5 text-[13px] text-[#b91c1c]"
                  >
                    <X size={14} />
                    Réinitialiser
                  </button>
                ) : null}
              </>
            ) : null}
          </div>
          <div className="ml-auto flex shrink-0 items-center gap-3">
            {maquette ? (
              <PeriodDatePicker
                portail="sp"
                variant="filtre"
                libelle="Période"
                value={periode}
                onChange={(range) => {
                  setPeriode(range);
                  setPage(1);
                }}
              />
            ) : null}
            <span className="text-[13px] whitespace-nowrap text-[#64748b]">
              {compteur}
            </span>
          </div>
        </div>

        <div className="overflow-x-auto">
          <div style={{ minWidth: 980 }}>
            <div
              className="grid items-center border-b border-[#e2e8f0] bg-[#f8fafc] text-[11.5px] font-semibold uppercase tracking-[0.06em] text-[#64748b]"
              style={{
                gridTemplateColumns: GRILLE,
                gap: 12,
                padding: "10px 18px",
              }}
            >
              <span>Référence</span>
              <span>Présentation</span>
              <span>Création</span>
              <span>Générée par</span>
              <span>Journée</span>
              <span className="text-right">Montant</span>
              <span>Statut</span>
            </div>

            {chargement ? (
              <div className="flex items-center justify-center gap-2 py-12 text-[#64748b]">
                <Loader2 className="size-5 animate-spin" />
                Chargement…
              </div>
            ) : erreur ? (
              <div className="flex flex-col items-center gap-1.5 py-12 text-[#64748b]">
                <Inbox className="size-5" />
                <span className="text-sm">Erreur de chargement.</span>
              </div>
            ) : fiches.length === 0 ? (
              <div className="flex flex-col items-center gap-1.5 py-12 text-[#64748b]">
                <Inbox className="size-5" />
                <span className="text-sm">Aucune fiche de dépôt.</span>
              </div>
            ) : (
              fiches.map((f) => {
                const st = statutDepotMaquette(f);
                return (
                  <button
                    key={f.reference}
                    type="button"
                    onClick={() => setPreviewRef(f.reference)}
                    className="grid w-full items-center border-b border-[#f1f5f9] text-left text-[13.5px] hover:bg-[#f8fafc]"
                    style={{
                      gridTemplateColumns: GRILLE,
                      gap: 12,
                      minHeight: 46,
                      padding: "8px 18px",
                    }}
                  >
                    <span
                      className="truncate font-medium tabular-nums text-[#0f172a]"
                      style={{
                        fontFamily: '"IBM Plex Mono", ui-monospace, monospace',
                        fontSize: 12.5,
                      }}
                    >
                      {f.reference}
                    </span>
                    <span className="text-[#475569]">
                      {f.date_presentation_libelle || f.date_presentation}
                    </span>
                    <span className="text-[#475569]">{f.date_creation}</span>
                    <span className="truncate text-[#0f172a]">{f.genere_par}</span>
                    <span
                      className="truncate tabular-nums text-[#475569]"
                      style={{
                        fontFamily: '"IBM Plex Mono", ui-monospace, monospace',
                        fontSize: 12.5,
                      }}
                    >
                      {f.journee_tresorerie_reference ?? "—"}
                    </span>
                    <span className="text-right font-semibold tabular-nums text-[#0f172a]">
                      {formaterMontantDepot(f.montant_total)}
                    </span>
                    <span>
                      <SpTag kind={st.kind}>{st.label}</SpTag>
                    </span>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {!chargement && !erreur && total > 0 ? (
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#e2e8f0] px-4 py-3">
            <div className="flex items-center gap-2">
              <p className="text-xs text-[#64748b]">Lignes par page</p>
              <Select
                value={pageSize}
                onValueChange={(v) => {
                  setPageSize(v);
                  setPage(1);
                }}
              >
                <SelectTrigger className="h-8 w-[76px] border-[#cbd5e1]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PAGE_SIZE_OPTIONS.map(({ value, label }) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {totalPages > 1 ? (
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
            ) : null}
          </div>
        ) : null}
      </div>

      <PreviewFicheDepotDialog
        reference={previewRef}
        onClose={() => setPreviewRef(null)}
      />
    </TooltipProvider>
  );
}

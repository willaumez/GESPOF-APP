import { useEffect, useState, type CSSProperties } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowRight,
  CalendarDays,
  Clock,
  Eye,
  FileDown,
  FilePlus,
  Inbox,
  Loader2,
  MoreVertical,
  Send,
  Zap,
} from "lucide-react";
import { toast } from "sonner";
import { requeteApi, requeteApiBlob } from "@/shared/lib/api";
import { SERVICE_REGLEMENT_ENDPOINTS } from "@/portails/Sr/api/endpoints";
import { getPortalMenu } from "@/shared/config/menu";
import { formatMontant } from "@/shared/lib/format";
import { useAuth } from "@/shared/hooks/use-auth";
import { cn } from "@/shared/lib/utils";
import { Skeleton } from "@/shared/components/ui/skeleton";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/shared/components/ui/alert-dialog";
import { Badge } from "@/shared/components/ui/badge";
import { Button } from "@/shared/components/ui/button";
import { Avatar, AvatarFallback } from "@/shared/components/ui/avatar";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/shared/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/shared/components/ui/dropdown-menu";
import {
  Empty,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  EmptyDescription,
} from "@/shared/components/ui/empty";
import { useCountUp } from "@/portails/Sr/hooks/useCountUp";
import {
  formaterDateHeureFr,
  formaterDateSansHeure,
} from "@/portails/Sr/components/fiche-detail/utils";
import type { Resume, FicheRecente } from "@/portails/Sr/types";

type StatutCfg = { badge: string; label: string };

const STATUT_CFG: Record<string, StatutCfg> = {
  cree: {
    badge: "border-transparent bg-slate-100 text-slate-700",
    label: "Créée",
  },
  envoyee: {
    badge: "border-transparent bg-emerald-100 text-emerald-800",
    label: "Envoyée",
  },
  recue: {
    badge: "border-transparent bg-amber-100 text-amber-900",
    label: "Reçue SP",
  },
};

const STATUT_JOUR_LABEL: Record<string, string> = {
  cree: "Créée",
  envoyee: "Envoyée",
  recue: "Reçue SP",
};

const theme = getPortalMenu("sr").theme;

function parseMontant(val: string | null | undefined): number {
  if (!val) return 0;
  const n = Number(String(val).replace(/\s/g, "").replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}

function initiales(nom: string): string {
  return nom
    .split(" ")
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function MontantAnime({
  valeur,
  suffixe = " FCFA",
  className,
}: {
  valeur: string | null | undefined;
  suffixe?: string;
  className?: string;
}) {
  const cible = parseMontant(valeur);
  const anime = useCountUp(cible);
  if (valeur == null || valeur === "") {
    return <span className={className}>—</span>;
  }
  return (
    <span className={cn("tabular-nums", className)}>
      {formatMontant(String(Math.round(anime)))}
      {suffixe}
    </span>
  );
}

export default function Generation() {
  const navigate = useNavigate();
  const { hasRole } = useAuth();
  const peutGenerer = hasRole("AGENT_SR");
  const peutConsulter = hasRole("AGENT_SR");

  const [resume, setResume] = useState<Resume | null>(null);
  const [fiches, setFiches] = useState<FicheRecente[]>([]);
  const [loadingResume, setLoadingResume] = useState(true);
  const [loadingFiches, setLoadingFiches] = useState(true);
  const [errorResume, setErrorResume] = useState(false);
  const [telechargementEnCours, setTelechargementEnCours] = useState<
    string | null
  >(null);
  const [confirmTelecharger, setConfirmTelecharger] =
    useState<FicheRecente | null>(null);

  const handleTelecharger = async (f: FicheRecente) => {
    if (telechargementEnCours) return;
    setTelechargementEnCours(f.reference);
    try {
      const chemin =
        `${SERVICE_REGLEMENT_ENDPOINTS.FICHE_DETAIL}/${encodeURIComponent(f.reference)}/telecharger`;
      const blob = await requeteApiBlob(chemin, {
        timeoutMs: 180_000,
      });
      const url = URL.createObjectURL(blob);
      const lien = document.createElement("a");
      lien.href = url;
      lien.download = `REGLEMENTS DU ${f.datePresentation.replace(/\//g, "-")}.xlsx`;
      document.body.appendChild(lien);
      lien.click();
      lien.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      toast.error(
        err instanceof Error
          ? err.message
          : "Impossible de télécharger le fichier.",
      );
    } finally {
      setTelechargementEnCours(null);
      setConfirmTelecharger(null);
    }
  };

  useEffect(() => {
    requeteApi<Resume>(SERVICE_REGLEMENT_ENDPOINTS.DASHBOARD_RESUME)
      .then(setResume)
      .catch(() => setErrorResume(true))
      .finally(() => setLoadingResume(false));
  }, []);

  useEffect(() => {
    requeteApi<FicheRecente[]>(
      SERVICE_REGLEMENT_ENDPOINTS.DASHBOARD_FICHES_RECENTES,
    )
      .then(setFiches)
      .catch(() => undefined)
      .finally(() => setLoadingFiches(false));
  }, []);

  const ficheJour = resume?.fiche_du_jour;
  const dernierTransmis = resume?.dernier_transmis;
  const enAttenteSp = resume?.en_attente_sp;
  const ficheExiste = Boolean(ficheJour?.existe);
  const jourBadge = ficheJour?.statut
    ? (STATUT_CFG[ficheJour.statut]?.badge ??
      "border-transparent bg-amber-100 text-amber-900")
    : "";
  const jourLabel = ficheJour?.statut
    ? (STATUT_JOUR_LABEL[ficheJour.statut] ?? "À traiter")
    : "";

  const styleHero: CSSProperties = {
    background: `
      radial-gradient(120% 80% at 100% 0%, ${theme.topColor}18 0%, transparent 55%),
      linear-gradient(135deg, ${theme.bgColor} 0%, #ffffff 48%, ${theme.bgColor} 100%)
    `,
    borderColor: `${theme.topColor}33`,
  };

  return (
    <div className="flex min-h-0 w-full flex-1 flex-col gap-2.5 pb-2 sm:gap-3">
      {/* Héros — fiche du jour */}
      <section
        className="relative shrink-0 overflow-hidden rounded-2xl border-2 px-4 py-3 sm:px-5 sm:py-3.5"
        style={styleHero}
      >
        <div
          className="pointer-events-none absolute -right-16 -top-20 size-44 rounded-full opacity-40"
          style={{ background: theme.iconBg }}
          aria-hidden
        />
        <div
          className="pointer-events-none absolute -bottom-24 left-1/3 size-52 rounded-full opacity-30"
          style={{ background: theme.iconBg }}
          aria-hidden
        />

        <div className="relative flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0 flex-1 space-y-2">
            <div className="flex items-center gap-2">
              <span
                className="flex size-8 items-center justify-center rounded-lg"
                style={{ background: theme.iconBg, color: theme.iconColor }}
              >
                <CalendarDays className="size-3.5" />
              </span>
              <div>
                <p
                  className="text-[10.5px] font-semibold tracking-[0.14em] uppercase"
                  style={{ color: theme.iconColor }}
                >
                  Fiche du jour
                </p>
                <p className="text-[12px] text-muted-foreground">
                  Génération et envoi vers le Service de Prévision
                </p>
              </div>
            </div>

            {loadingResume ? (
              <div className="space-y-1.5">
                <Skeleton className="h-8 w-56 max-w-full" />
                <Skeleton className="h-4 w-36" />
              </div>
            ) : errorResume ? (
              <div className="space-y-1.5">
                <p className="font-heading text-xl font-bold tracking-tight text-muted-foreground/50 sm:text-2xl">
                  —
                </p>
                <p className="text-[12.5px] text-destructive">
                  Impossible de charger les données. Rafraîchissez la page.
                </p>
              </div>
            ) : ficheExiste && ficheJour?.montant_total ? (
              <div className="space-y-1.5">
                <p className="font-heading text-[1.45rem] font-bold leading-none tracking-tight text-[#0f172a] sm:text-[1.85rem]">
                  <MontantAnime valeur={ficheJour.montant_total} />
                </p>
                <div className="flex flex-wrap items-center gap-2">
                  {ficheJour.statut ? (
                    <Badge className={jourBadge}>{jourLabel}</Badge>
                  ) : null}
                  {ficheJour.reference ? (
                    <span className="font-mono text-[12px] font-semibold text-[#0f172a]/80">
                      {ficheJour.reference}
                    </span>
                  ) : null}
                  {ficheJour.date ? (
                    <span className="text-[12px] text-muted-foreground">
                      {ficheJour.date}
                    </span>
                  ) : null}
                  {peutConsulter && ficheJour.reference ? (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-7 gap-1.5 border-2 bg-white/70 px-2.5 text-[12px]"
                      style={{ borderColor: `${theme.topColor}44` }}
                      onClick={() =>
                        navigate(
                          `/sr/fiche/${encodeURIComponent(ficheJour.reference!)}`,
                        )
                      }
                    >
                      <Eye className="size-3.5" />
                      Ouvrir la fiche
                    </Button>
                  ) : null}
                </div>
              </div>
            ) : (
              <div className="space-y-1.5">
                <p className="font-heading text-[1.45rem] font-bold leading-none tracking-tight text-[#0f172a]/55 sm:text-[1.85rem]">
                  Non générée
                </p>
                <p className="max-w-lg text-[12.5px] leading-snug text-muted-foreground">
                  Aucune fiche de dépôt pour aujourd&apos;hui
                  {ficheJour?.date ? ` (${ficheJour.date})` : ""}. Lancez une
                  génération pour transmettre les règlements au SP.
                </p>
              </div>
            )}
          </div>

          {peutGenerer ? (
            <div className="flex shrink-0 flex-col gap-1.5 sm:flex-row lg:flex-col">
              <Button
                type="button"
                size="default"
                onClick={() => navigate("/sr/generer")}
                className="h-9 gap-2 px-4 text-[13px] font-semibold text-white shadow-md hover:opacity-95"
                style={{ background: theme.ctaColor }}
              >
                <Zap className="size-3.5" strokeWidth={2.2} />
                {ficheExiste
                  ? "Nouvelle génération"
                  : "Générer une fiche de dépôt"}
              </Button>
              <Button
                type="button"
                variant="outline"
                size="default"
                className="h-9 gap-2 border-2 bg-white/80 px-4"
                style={{ borderColor: `${theme.topColor}40` }}
                onClick={() => navigate("/sr/fiches-depenses")}
              >
                <Clock className="size-3.5" />
                Liste des fiches
              </Button>
            </div>
          ) : (
            <Button
              type="button"
              variant="outline"
              size="default"
              className="h-9 gap-2 border-2 bg-white/80 px-4"
              style={{ borderColor: `${theme.topColor}40` }}
              onClick={() => navigate("/sr/fiches-depenses")}
            >
              <Clock className="size-3.5" />
              Liste des fiches
            </Button>
          )}
        </div>
      </section>

      {/* Métriques secondaires */}
      <section className="grid shrink-0 gap-2.5 sm:grid-cols-2">
        <button
          type="button"
          className="group flex items-center gap-3 rounded-xl border-2 bg-card px-3.5 py-2.5 text-left transition-shadow hover:shadow-md sm:px-4"
          style={{ borderColor: `${theme.topColor}22` }}
          onClick={() =>
            dernierTransmis?.reference && peutConsulter
              ? navigate(
                  `/sr/fiche/${encodeURIComponent(dernierTransmis.reference)}`,
                )
              : navigate("/sr/fiches-depenses")
          }
        >
          <span
            className="flex size-9 shrink-0 items-center justify-center rounded-lg"
            style={{ background: theme.iconBg, color: theme.iconColor }}
          >
            <Send className="size-3.5" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-medium text-muted-foreground">
              Dernier montant transmis
            </p>
            {loadingResume ? (
              <Skeleton className="mt-1 h-6 w-36" />
            ) : dernierTransmis ? (
              <>
                <p className="mt-0.5 font-heading text-lg font-bold tracking-tight text-[#0f172a] sm:text-xl">
                  <MontantAnime
                    valeur={dernierTransmis.montant_total}
                    suffixe=""
                  />
                  <span className="ml-1.5 text-[12px] font-semibold text-muted-foreground">
                    FCFA
                  </span>
                </p>
                <p className="truncate text-[12px] text-muted-foreground">
                  {dernierTransmis.date}
                  {dernierTransmis.reference
                    ? ` · ${dernierTransmis.reference}`
                    : ""}
                </p>
              </>
            ) : (
              <p className="mt-0.5 font-heading text-base font-bold text-muted-foreground/50">
                Aucun transmis
              </p>
            )}
          </div>
          <ArrowRight className="size-4 shrink-0 text-muted-foreground/40 transition-transform group-hover:translate-x-0.5 group-hover:text-muted-foreground" />
        </button>

        <button
          type="button"
          className="group flex items-center gap-3 rounded-xl border-2 bg-card px-3.5 py-2.5 text-left transition-shadow hover:shadow-md sm:px-4"
          style={{ borderColor: `${theme.topColor}22` }}
          onClick={() => navigate("/sr/fiches-depenses")}
        >
          <span
            className="flex size-9 shrink-0 items-center justify-center rounded-lg"
            style={{ background: theme.iconBg, color: theme.iconColor }}
          >
            <Inbox className="size-3.5" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-medium text-muted-foreground">
              En attente SP
            </p>
            {loadingResume ? (
              <Skeleton className="mt-1 h-6 w-14" />
            ) : (
              <>
                <p className="mt-0.5 font-heading text-lg font-bold tracking-tight text-[#0f172a] sm:text-xl">
                  {enAttenteSp?.nombre ?? 0}
                </p>
                <p className="text-[12px] text-muted-foreground">
                  {(enAttenteSp?.nombre ?? 0) <= 1
                    ? "fiche envoyée non lue"
                    : "fiches envoyées non lues"}
                </p>
              </>
            )}
          </div>
          <ArrowRight className="size-4 shrink-0 text-muted-foreground/40 transition-transform group-hover:translate-x-0.5 group-hover:text-muted-foreground" />
        </button>
      </section>

      {/* Fiches récentes */}
      <section
        className="shrink-0 overflow-hidden rounded-2xl border-2 bg-card"
        style={{ borderColor: `${theme.topColor}28` }}
      >
        <div
          className="flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3 sm:px-5"
          style={{ borderColor: `${theme.topColor}18` }}
        >
          <div>
            <h2 className="text-[15px] font-bold text-[#0f172a]">
              Fiches récentes
            </h2>
            <p className="text-[12.5px] text-muted-foreground">
              Cinq dernières générations
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={() => navigate("/sr/fiches-depenses")}
          >
            Voir tout
            <ArrowRight className="size-3.5" />
          </Button>
        </div>

        <Table>
          <TableHeader>
            <TableRow
              className="hover:bg-transparent"
              style={{ background: theme.bgColor }}
            >
              <TableHead className="h-11 text-[11px] font-bold uppercase tracking-wider text-[#0f172a]/70">
                Référence
              </TableHead>
              <TableHead className="h-11 text-[11px] font-bold uppercase tracking-wider text-[#0f172a]/70">
                Présentation
              </TableHead>
              <TableHead className="h-11 text-[11px] font-bold uppercase tracking-wider text-[#0f172a]/70">
                Montant
              </TableHead>
              <TableHead className="h-11 text-[11px] font-bold uppercase tracking-wider text-[#0f172a]/70">
                Généré par
              </TableHead>
              <TableHead className="h-11 text-[11px] font-bold uppercase tracking-wider text-[#0f172a]/70">
                Statut
              </TableHead>
              <TableHead className="h-11 text-[11px] font-bold uppercase tracking-wider text-[#0f172a]/70">
                Création
              </TableHead>
              <TableHead className="h-11 text-right text-[11px] font-bold uppercase tracking-wider text-[#0f172a]/70">
                Actions
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loadingFiches ? (
              Array.from({ length: 5 }).map((_, idx) => (
                <TableRow key={idx}>
                  <TableCell>
                    <Skeleton className="h-4 w-36" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-4 w-24" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-4 w-28" />
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Skeleton className="size-6 rounded-full" />
                      <Skeleton className="h-4 w-20" />
                    </div>
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-5 w-20 rounded-full" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-4 w-28" />
                  </TableCell>
                  <TableCell className="text-right">
                    <Skeleton className="ml-auto h-4 w-16" />
                  </TableCell>
                </TableRow>
              ))
            ) : fiches.length === 0 ? (
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={7} className="py-12">
                  <Empty>
                    <EmptyHeader>
                      <EmptyMedia variant="icon">
                        <FilePlus />
                      </EmptyMedia>
                      <EmptyTitle>Aucune fiche générée</EmptyTitle>
                      <EmptyDescription>
                        {peutGenerer
                          ? "Générez la première fiche de dépôt pour démarrer la journée."
                          : "Les fiches générées récemment apparaîtront ici."}
                      </EmptyDescription>
                    </EmptyHeader>
                  </Empty>
                  {peutGenerer ? (
                    <div className="mt-4 flex justify-center">
                      <Button
                        type="button"
                        className="gap-2 text-white"
                        style={{ background: theme.ctaColor }}
                        onClick={() => navigate("/sr/generer")}
                      >
                        <Zap className="size-4" />
                        Générer une fiche de dépôt
                      </Button>
                    </div>
                  ) : null}
                </TableCell>
              </TableRow>
            ) : (
              fiches.map((f) => {
                const st = STATUT_CFG[f.statut] ?? {
                  badge: "border-transparent bg-slate-100 text-slate-700",
                  label: f.statut,
                };
                return (
                  <TableRow
                    key={f.reference}
                    className={peutConsulter ? "cursor-pointer" : undefined}
                    onClick={() =>
                      peutConsulter &&
                      navigate(`/sr/fiche/${encodeURIComponent(f.reference)}`)
                    }
                  >
                    <TableCell
                      className="font-mono text-[13px] font-semibold"
                      style={{ color: theme.iconColor }}
                    >
                      {f.reference}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {formaterDateSansHeure(f.datePresentation)}
                    </TableCell>
                    <TableCell>
                      <span className="font-semibold tabular-nums text-[#0f172a]">
                        {formatMontant(f.montant_total)}
                      </span>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Avatar size="sm">
                          <AvatarFallback
                            className="text-[10px] font-bold text-white"
                            style={{ background: theme.ctaColor }}
                          >
                            {initiales(f.genere_par)}
                          </AvatarFallback>
                        </Avatar>
                        <span className="text-muted-foreground">
                          {f.genere_par}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge className={st.badge}>{st.label}</Badge>
                    </TableCell>
                    <TableCell className="tabular-nums text-muted-foreground">
                      {formaterDateHeureFr(f.date_creation)}
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
                              className="size-8"
                              aria-label={`Actions pour ${f.reference}`}
                            >
                              <MoreVertical className="size-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-52">
                            <DropdownMenuLabel>Actions</DropdownMenuLabel>
                            <DropdownMenuItem
                              disabled={!peutConsulter}
                              onSelect={() => {
                                if (!peutConsulter) return;
                                navigate(
                                  `/sr/fiche/${encodeURIComponent(f.reference)}`,
                                );
                              }}
                            >
                              <Eye
                                className="size-4"
                                style={{ color: theme.iconColor }}
                              />
                              {peutConsulter
                                ? "Voir le détail"
                                : "Accès non autorisé"}
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              disabled={
                                !peutConsulter ||
                                !f.chemin_fichier ||
                                telechargementEnCours === f.reference
                              }
                              onSelect={() => {
                                if (!peutConsulter || !f.chemin_fichier) return;
                                setConfirmTelecharger(f);
                              }}
                            >
                              {telechargementEnCours === f.reference ? (
                                <Loader2 className="size-4 animate-spin text-emerald-600" />
                              ) : (
                                <FileDown
                                  className={cn(
                                    "size-4",
                                    peutConsulter && f.chemin_fichier
                                      ? "text-emerald-600"
                                      : "text-muted-foreground/40",
                                  )}
                                />
                              )}
                              {!peutConsulter
                                ? "Accès non autorisé"
                                : f.chemin_fichier
                                  ? "Télécharger le fichier"
                                  : "Fichier indisponible"}
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
      </section>

      <AlertDialog
        open={confirmTelecharger !== null}
        onOpenChange={(o) => {
          if (!o) setConfirmTelecharger(null);
        }}
      >
        <AlertDialogContent size="sm">
          <AlertDialogHeader>
            <AlertDialogTitle>Télécharger la fiche</AlertDialogTitle>
            <AlertDialogDescription>
              Voulez-vous télécharger le fichier Excel de la fiche{" "}
              {confirmTelecharger?.reference} ?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              disabled={
                !confirmTelecharger ||
                telechargementEnCours === confirmTelecharger.reference
              }
              onClick={() => {
                if (confirmTelecharger)
                  void handleTelecharger(confirmTelecharger);
              }}
            >
              {telechargementEnCours === confirmTelecharger?.reference ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Téléchargement…
                </>
              ) : (
                "Télécharger"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

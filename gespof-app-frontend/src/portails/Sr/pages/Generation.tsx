import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowRight,
  CalendarDays,
  ChevronRight,
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
import { SrPageHeader } from "@/portails/Sr/components/layout/SrPageHeader";
import type { Resume, FicheRecente } from "@/portails/Sr/types";

function ChevronRightIcon() {
  return (
    <ChevronRight
      size={18}
      className="shrink-0 text-[#94a3b8] transition-transform group-hover:translate-x-0.5"
      aria-hidden
    />
  );
}

const STATUT_JOUR_LABEL: Record<string, string> = {
  cree: "Créée",
  envoyee: "Envoyée au SP",
  recue: "Reçue par le SP",
};

/** Badges statut maquette (fond pastel). */
const STATUT_TAG: Record<string, { bg: string; fg: string; label: string }> = {
  cree: { bg: "#f1f5f9", fg: "#475569", label: "Créée" },
  envoyee: { bg: "#ecfdf5", fg: "#047857", label: "Envoyée" },
  recue: { bg: "#fffbeb", fg: "#b45309", label: "Reçue SP" },
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
  const jourLabel = ficheJour?.statut
    ? (STATUT_JOUR_LABEL[ficheJour.statut] ?? "À traiter")
    : "Non générée";

  const dateLongue = new Date().toLocaleDateString("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return (
    <div className="flex w-full flex-col gap-6">
      <SrPageHeader
        eyebrow={`Pool SR · Génération · ${dateLongue.charAt(0).toUpperCase()}${dateLongue.slice(1)}`}
        title="Tableau de bord"
        description="Génération et transmission des fiches de dépôt vers le Service de Prévision."
      />

      {/* Bannière fiche du jour — maquette */}
      <section
        className="flex flex-wrap items-center gap-5 rounded-lg border px-[24px] py-[22px]"
        style={{
          background: theme.bgColor,
          borderColor: theme.borderColor,
          boxShadow: `inset 4px 0 0 ${theme.topColor}`,
        }}
      >
        <span
          className="grid size-11 shrink-0 place-items-center rounded-lg border bg-white"
          style={{
            color: theme.textColor,
            borderColor: theme.borderColor,
          }}
        >
          <CalendarDays size={20} strokeWidth={1.7} />
        </span>
        <div className="flex min-w-[240px] flex-1 flex-col gap-1">
          <span
            className="text-[11.5px] font-semibold uppercase tracking-[0.12em]"
            style={{ color: theme.textColor }}
          >
            Fiche du jour
          </span>
          {loadingResume ? (
            <Skeleton className="h-8 w-48" />
          ) : errorResume ? (
            <span className="text-sm text-destructive">
              Impossible de charger les données.
            </span>
          ) : (
            <>
              <span
                className="text-[26px] font-semibold leading-[1.15] text-[#0f172a]"
                style={{
                  fontFamily: '"IBM Plex Serif", "IBM Plex Sans", serif',
                }}
              >
                {ficheExiste ? jourLabel : "Non générée"}
              </span>
              <span className="text-sm text-[#475569]">
                {ficheExiste && ficheJour?.reference ? (
                  <>
                    <span
                      className="font-mono"
                      style={{
                        fontFamily: '"IBM Plex Mono", ui-monospace, monospace',
                      }}
                    >
                      {ficheJour.reference}
                    </span>
                    {ficheJour.montant_total
                      ? ` · ${formatMontant(ficheJour.montant_total)} FCFA`
                      : ""}
                    {ficheJour.date ? ` · ${ficheJour.date}` : ""}
                  </>
                ) : (
                  <>
                    Aucune fiche pour aujourd&apos;hui
                    {ficheJour?.date ? ` (${ficheJour.date})` : ""}.
                  </>
                )}
              </span>
            </>
          )}
        </div>
        <div className="flex min-w-[230px] flex-col gap-2">
          {peutGenerer ? (
            <button
              type="button"
              onClick={() => navigate("/sr/generer")}
              className="flex h-10 items-center justify-center gap-2 rounded-md px-4 text-sm font-semibold text-white transition-colors"
              style={{ background: theme.ctaColor }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = theme.hoverColor;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = theme.ctaColor;
              }}
            >
              <Zap size={16} strokeWidth={2} />
              Générer une fiche de dépôt
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => navigate("/sr/fiches-depenses")}
            className="flex h-10 items-center justify-center gap-2 rounded-md border border-[#cbd5e1] bg-white px-4 text-sm text-[#0f172a] transition-colors hover:bg-[#f8fafc]"
          >
            <Clock size={16} strokeWidth={1.8} />
            Liste des fiches
          </button>
        </div>
      </section>

      {/* Cartes KPI */}
      <section
        className="grid gap-4"
        style={{
          gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
        }}
      >
        <button
          type="button"
          className="group flex items-center gap-4 rounded-lg border border-[#e2e8f0] bg-white px-5 py-[18px] text-left transition-colors"
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = theme.topColor;
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = "#e2e8f0";
          }}
          onClick={() =>
            dernierTransmis?.reference && peutConsulter
              ? navigate(
                  `/sr/fiche/${encodeURIComponent(dernierTransmis.reference)}`,
                )
              : navigate("/sr/fiches-depenses")
          }
        >
          <span
            className="grid size-10 shrink-0 place-items-center rounded-lg"
            style={{ background: theme.iconBg, color: theme.textColor }}
          >
            <Send size={18} strokeWidth={1.7} />
          </span>
          <span className="flex min-w-0 flex-1 flex-col gap-0.5">
            <span className="text-[12.5px] text-[#64748b]">
              Dernier montant transmis
            </span>
            {loadingResume ? (
              <Skeleton className="h-7 w-40" />
            ) : dernierTransmis ? (
              <>
                <span className="text-[22px] font-semibold tabular-nums text-[#0f172a]">
                  <MontantAnime
                    valeur={dernierTransmis.montant_total}
                    suffixe=""
                  />{" "}
                  <span className="text-xs font-normal text-[#64748b]">
                    FCFA
                  </span>
                </span>
                <span className="truncate text-[12.5px] text-[#64748b]">
                  {dernierTransmis.date}
                  {dernierTransmis.reference
                    ? ` · ${dernierTransmis.reference}`
                    : ""}
                </span>
              </>
            ) : (
              <span className="text-base font-semibold text-[#94a3b8]">
                Aucun transmis
              </span>
            )}
          </span>
          <ChevronRightIcon />
        </button>

        <button
          type="button"
          className="group flex items-center gap-4 rounded-lg border border-[#e2e8f0] bg-white px-5 py-[18px] text-left transition-colors"
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = theme.topColor;
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = "#e2e8f0";
          }}
          onClick={() =>
            navigate("/sr/fiches-depenses?filtre=en_attente")
          }
        >
          <span
            className="grid size-10 shrink-0 place-items-center rounded-lg"
            style={{ background: theme.iconBg, color: theme.textColor }}
          >
            <Inbox size={18} strokeWidth={1.7} />
          </span>
          <span className="flex min-w-0 flex-1 flex-col gap-0.5">
            <span className="text-[12.5px] text-[#64748b]">En attente SP</span>
            {loadingResume ? (
              <Skeleton className="h-7 w-12" />
            ) : (
              <>
                <span className="text-[22px] font-semibold text-[#0f172a]">
                  {enAttenteSp?.nombre ?? 0}
                </span>
                <span className="text-[12.5px] text-[#64748b]">
                  {(enAttenteSp?.nombre ?? 0) <= 1
                    ? "fiche envoyée non lue"
                    : "fiches envoyées non lues"}
                </span>
              </>
            )}
          </span>
          <ChevronRightIcon />
        </button>
      </section>

      {/* Fiches récentes — hauteur naturelle, scroll page entière */}
      <section className="flex flex-col rounded-lg border border-[#e2e8f0] bg-white">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#e2e8f0] px-[18px] py-3.5">
          <div className="flex flex-col gap-0.5">
            <span className="text-[15px] font-semibold text-[#0f172a]">
              Fiches récentes
            </span>
            <span className="text-[12.5px] text-[#64748b]">
              Six dernières générations
            </span>
          </div>
          <button
            type="button"
            onClick={() => navigate("/sr/fiches-depenses")}
            className="flex h-8 items-center gap-1.5 rounded-md border border-[#e2e8f0] bg-white px-3 text-[13px] text-[#0f172a] transition-colors hover:border-[#94a3b8]"
          >
            Voir tout
            <ArrowRight size={14} />
          </button>
        </div>

        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent border-b border-[#e2e8f0] bg-[#f8fafc]">
              <TableHead className="h-10 px-[18px] text-[11.5px] font-semibold uppercase tracking-[0.06em] text-[#64748b]">
                Référence
              </TableHead>
              <TableHead className="h-10 text-[11.5px] font-semibold uppercase tracking-[0.06em] text-[#64748b]">
                Présentation
              </TableHead>
              <TableHead className="h-10 text-right text-[11.5px] font-semibold uppercase tracking-[0.06em] text-[#64748b]">
                Montant (FCFA)
              </TableHead>
              <TableHead className="h-10 text-[11.5px] font-semibold uppercase tracking-[0.06em] text-[#64748b]">
                Généré par
              </TableHead>
              <TableHead className="h-10 text-[11.5px] font-semibold uppercase tracking-[0.06em] text-[#64748b]">
                Statut
              </TableHead>
              <TableHead className="h-10 text-[11.5px] font-semibold uppercase tracking-[0.06em] text-[#64748b]">
                Création
              </TableHead>
              <TableHead className="h-10 w-10" />
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
                const st = STATUT_TAG[f.statut] ?? {
                  bg: "#f1f5f9",
                  fg: "#475569",
                  label: f.statut,
                };
                return (
                  <TableRow
                    key={f.reference}
                    className={cn(
                      "border-b border-[#f1f5f9] text-sm hover:bg-[#f8fafc]",
                      peutConsulter && "cursor-pointer",
                    )}
                    onClick={() =>
                      peutConsulter &&
                      navigate(`/sr/fiche/${encodeURIComponent(f.reference)}`)
                    }
                  >
                    <TableCell
                      className="px-[18px] font-mono text-[13px] font-medium"
                      style={{
                        fontFamily: '"IBM Plex Mono", ui-monospace, monospace',
                        color: theme.textColor,
                      }}
                    >
                      {f.reference}
                    </TableCell>
                    <TableCell className="tabular-nums text-[#475569]">
                      {formaterDateSansHeure(f.datePresentation)}
                    </TableCell>
                    <TableCell className="text-right">
                      <span className="font-semibold tabular-nums text-[#0f172a]">
                        {formatMontant(f.montant_total)}
                      </span>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2.5">
                        <Avatar size="sm">
                          <AvatarFallback
                            className="text-[11px] font-semibold"
                            style={{
                              background: theme.iconBg,
                              color: theme.textColor,
                            }}
                          >
                            {initiales(f.genere_par)}
                          </AvatarFallback>
                        </Avatar>
                        <span className="text-[#0f172a]">{f.genere_par}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span
                        className="inline-block rounded px-[9px] py-0.5 text-xs font-medium"
                        style={{ background: st.bg, color: st.fg }}
                      >
                        {st.label}
                      </span>
                    </TableCell>
                    <TableCell className="tabular-nums text-[#475569]">
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

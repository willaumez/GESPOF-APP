import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowRight,
  ChevronRight,
  CalendarDays,
  TrendingUp,
  Clock,
  Zap,
  FilePlus,
  Eye,
  AlertCircle,
  FileDown,
  Inbox,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { requeteApi, requeteApiBlob } from "@/lib/api";
import { API_ENDPOINTS } from "@/config/app";
import { getPortalMenu } from "@/config/menu";
import { formatMontant } from "@/lib/format";
import { useAuth } from "@/hooks/use-auth";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Card,
  CardHeader,
  CardContent,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Empty,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  EmptyDescription,
} from "@/components/ui/empty";
import type { Resume, FicheRecente } from "@/interfaces/pool-sr";

type StatutCfg = { badge: string; label: string };
const STATUT_CFG: Record<string, StatutCfg> = {
  cree: {
    badge: "border-transparent bg-muted text-muted-foreground",
    label: "Créée",
  },
  envoyee: {
    badge: "border-transparent bg-success/10 text-success",
    label: "Envoyée",
  },
  recue: { badge: "border-transparent bg-warning/10 text-warning", label: "Reçue" },
};
const STATUT_JOUR_LABEL: Record<string, string> = {
  cree: "Créée",
  envoyee: "Envoyée",
  recue: "Reçue",
};

const THEME_VERT = getPortalMenu("sof").theme;
const THEME_JAUNE = getPortalMenu("sp").theme;
const THEME_BLEU = getPortalMenu("dr").theme;

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

  const handleTelecharger = async (f: FicheRecente) => {
    if (!f.chemin_fichier || telechargementEnCours) return;
    setTelechargementEnCours(f.reference);
    try {
      const blob = await requeteApiBlob(f.chemin_fichier);
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
    }
  };

  useEffect(() => {
    requeteApi<Resume>(API_ENDPOINTS.POOL_SR.DASHBOARD_RESUME)
      .then((data) => {
        console.log("[Generation] resume backend:", data);
        setResume(data);
      })
      .catch((error) => {
        console.error("[Generation] resume backend error:", error);
        setErrorResume(true);
      })
      .finally(() => setLoadingResume(false));
  }, []);

  useEffect(() => {
    requeteApi<FicheRecente[]>(API_ENDPOINTS.POOL_SR.DASHBOARD_FICHES_RECENTES)
      .then((data) => {
        console.log("[Generation] fiches récentes backend:", data);
        setFiches(data);
      })
      .catch((error) =>
        console.error("[Generation] fiches récentes backend error:", error),
      )
      .finally(() => setLoadingFiches(false));
  }, []);

  const ficheJour = resume?.fiche_du_jour;
  const dernierTransmis = resume?.dernier_transmis;
  const enAttenteSp = resume?.en_attente_sp;

  const jourBadge = ficheJour?.statut
    ? (STATUT_CFG[ficheJour.statut]?.badge ??
      "border-transparent bg-warning/10 text-warning")
    : "";
  const jourLabel = ficheJour?.statut
    ? (STATUT_JOUR_LABEL[ficheJour.statut] ?? "À traiter")
    : "";

  return (
    <div className="space-y-5">
      {}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <p className="max-w-xl text-sm leading-relaxed text-muted-foreground">
          Génération de la fiche de dépôt et transmission vers le Service de
          Prévision (SP).
        </p>
        {peutGenerer && (
          <Button
            size="lg"
            onClick={() => navigate("/dr/generer")}
            className="gap-2 px-5 shadow-[0_3px_12px_rgba(15,23,42,0.25)]"
          >
            <Zap className="size-4" strokeWidth={2.2} />
            Générer une fiche de dépôt
          </Button>
        )}
      </div>

      {}
      <div className="grid gap-4 sm:grid-cols-3">
        {}
        <Card
          className="transition-all duration-200 hover:shadow-md hover:border-primary/20 cursor-pointer border-t-4"
          style={{ borderTopColor: THEME_VERT.topColor }}
        >
          <CardContent className="flex items-start justify-between gap-4">
            <div className="min-w-0 flex-1">
              <p className="mb-1.5 text-[10.5px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                Fiche du jour
              </p>
              {loadingResume ? (
                <div className="space-y-2">
                  <Skeleton className="h-7 w-32" />
                  <Skeleton className="h-4 w-24" />
                </div>
              ) : errorResume ? (
                <p className="font-heading text-xl font-bold text-muted-foreground/40">
                  —
                </p>
              ) : (
                <>
                  <p className="font-heading text-2xl font-bold text-foreground">
                    {ficheJour?.existe && ficheJour.montant_total
                      ? `${formatMontant(ficheJour.montant_total)} FCFA`
                      : "Non générée"}
                  </p>
                  <div className="mt-2 flex items-center gap-2">
                    {ficheJour?.statut && (
                      <Badge className={jourBadge}>{jourLabel}</Badge>
                    )}
                    <span className="text-xs text-muted-foreground">
                      {ficheJour?.reference
                        ? `Réf. ${ficheJour.reference}`
                        : ficheJour?.date}
                    </span>
                  </div>
                </>
              )}
            </div>
            <div className="flex items-center gap-1.5">
              {errorResume && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="flex cursor-default items-center text-destructive">
                      <AlertCircle className="size-3.5" />
                    </span>
                  </TooltipTrigger>
                  <TooltipContent side="top">
                    Impossible de charger les données. Veuillez rafraîchir la
                    page.
                  </TooltipContent>
                </Tooltip>
              )}
              <span
                className="flex size-9 shrink-0 items-center justify-center rounded-lg transition-colors duration-200"
                style={{ backgroundColor: THEME_VERT.iconBg, color: THEME_VERT.iconColor }}
              >
                <CalendarDays className="size-4" />
              </span>
            </div>
          </CardContent>
        </Card>

        {}
        <Card
          className="transition-all duration-200 hover:shadow-md hover:border-primary/20 cursor-pointer border-t-4"
          style={{ borderTopColor: THEME_JAUNE.topColor }}
        >
          <CardContent className="flex items-start justify-between gap-4">
            <div className="min-w-0 flex-1">
              <p className="mb-1.5 text-[10.5px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                Dernier montant transmis
              </p>
              {loadingResume ? (
                <div className="space-y-2">
                  <Skeleton className="h-7 w-36" />
                  <Skeleton className="h-4 w-28" />
                </div>
              ) : dernierTransmis ? (
                <>
                  <p className="font-heading text-2xl font-bold text-foreground">
                    {formatMontant(dernierTransmis.montant_total)}
                  </p>
                  <div className="mt-2 flex items-center gap-2">
                    <Badge className="border-transparent bg-primary/10 text-primary">
                      Transmis
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {dernierTransmis.date}
                    </span>
                  </div>
                </>
              ) : (
                <p className="font-heading text-xl font-bold text-muted-foreground/40">
                  Aucun transmis
                </p>
              )}
            </div>
            <span
              className="flex size-9 shrink-0 items-center justify-center rounded-lg transition-colors duration-200"
              style={{ backgroundColor: THEME_JAUNE.iconBg, color: THEME_JAUNE.iconColor }}
            >
              <TrendingUp className="size-4" />
            </span>
          </CardContent>
        </Card>

        {}
        <Card
          className="transition-all duration-200 hover:shadow-md hover:border-primary/20 cursor-pointer border-t-4"
          style={{ borderTopColor: THEME_BLEU.topColor }}
        >
          <CardContent className="flex items-start justify-between gap-4">
            <div className="min-w-0 flex-1">
              <p className="mb-1.5 text-[10.5px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                En attente SP
              </p>
              {loadingResume ? (
                <div className="space-y-2">
                  <Skeleton className="h-7 w-12" />
                  <Skeleton className="h-4 w-32" />
                </div>
              ) : (
                <>
                  <p className="font-heading text-2xl font-bold text-foreground">
                    {enAttenteSp?.nombre ?? 0}
                  </p>
                  <div className="mt-2 flex items-center gap-2">
                    <Badge className="border-transparent bg-primary/10 text-primary">
                      SP
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {(enAttenteSp?.nombre ?? 0) <= 1
                        ? "fiche envoyée non lue"
                        : "fiches envoyées non lues"}
                    </span>
                  </div>
                </>
              )}
            </div>
            <span
              className="flex size-9 shrink-0 items-center justify-center rounded-lg transition-colors duration-200"
              style={{ backgroundColor: THEME_BLEU.iconBg, color: THEME_BLEU.iconColor }}
            >
              <Clock className="size-4" />
            </span>
          </CardContent>
        </Card>
      </div>

      {}
      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        {}
        <Card className="gap-0 overflow-hidden py-0">
          <CardHeader className="flex flex-row items-center justify-between border-b py-4">
            <div className="flex-1">
              <CardTitle>Fiches récentes</CardTitle>
              <CardDescription>5 dernières fiches générées</CardDescription>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate("/dr/fiches-depenses")}
            >
              Voir tout
              <ArrowRight className="ml-1 size-3.5" />
            </Button>
          </CardHeader>

          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow className="border-b-2 border-b-primary/20 bg-muted/60 hover:bg-muted/60">
                  <TableHead className="h-11 text-[11px] font-bold uppercase tracking-wider text-foreground">
                    Référence
                  </TableHead>
                  <TableHead className="h-11 text-[11px] font-bold uppercase tracking-wider text-foreground">
                    Date présentation
                  </TableHead>
                  <TableHead className="h-11 text-[11px] font-bold uppercase tracking-wider text-foreground">
                    Montant total (FCFA)
                  </TableHead>
                  <TableHead className="h-11 text-[11px] font-bold uppercase tracking-wider text-foreground">
                    Généré par
                  </TableHead>
                  <TableHead className="h-11 text-[11px] font-bold uppercase tracking-wider text-foreground">
                    Statut
                  </TableHead>
                  <TableHead className="h-11 text-[11px] font-bold uppercase tracking-wider text-foreground">
                    Date création
                  </TableHead>
                  <TableHead className="h-11 text-right text-[11px] font-bold uppercase tracking-wider text-foreground">
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
                        <Skeleton className="h-4 w-28" />
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
                        <Skeleton className="h-4 w-32" />
                      </TableCell>
                      <TableCell className="text-right">
                        <Skeleton className="ml-auto h-4 w-16" />
                      </TableCell>
                    </TableRow>
                  ))
                ) : fiches.length === 0 ? (
                  <TableRow className="hover:bg-transparent">
                    <TableCell colSpan={7} className="py-10">
                      <Empty>
                        <EmptyHeader>
                          <EmptyMedia variant="icon">
                            <Inbox />
                          </EmptyMedia>
                          <EmptyTitle>Aucune fiche générée</EmptyTitle>
                          <EmptyDescription>
                            Les fiches générées récemment apparaîtront ici.
                          </EmptyDescription>
                        </EmptyHeader>
                      </Empty>
                    </TableCell>
                  </TableRow>
                ) : (
                  fiches.map((f) => {
                    const st = STATUT_CFG[f.statut] ?? {
                      badge:
                        "border-transparent bg-muted text-muted-foreground",
                      label: f.statut,
                    };
                    const initials = f.genere_par
                      .split(" ")
                      .map((p) => p[0])
                      .join("")
                      .slice(0, 2)
                      .toUpperCase();
                    return (
                      <TableRow
                        key={f.reference}
                        className={
                          peutConsulter ? "cursor-pointer" : undefined
                        }
                        onClick={() =>
                          peutConsulter &&
                          navigate(`/dr/fiche/${encodeURIComponent(f.reference)}`)
                        }
                      >
                        <TableCell className="font-mono font-semibold text-primary">
                          {f.reference}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {f.datePresentation}
                        </TableCell>
                        <TableCell>
                          <span className="font-semibold text-foreground">
                            {formatMontant(f.montant_total)}
                          </span>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Avatar size="sm">
                              <AvatarFallback className="bg-primary text-[10px] font-bold text-primary-foreground">
                                {initials}
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
                        <TableCell className="text-muted-foreground">
                          {f.date_creation}
                        </TableCell>
                        <TableCell
                          className="text-right"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <div className="flex items-center justify-end gap-1">
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span className="inline-flex">
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    disabled={!peutConsulter}
                                    onClick={() =>
                                      peutConsulter &&
                                      navigate(`/dr/fiche/${encodeURIComponent(f.reference)}`)
                                    }
                                  >
                                    <Eye className="size-4 text-blue-600 dark:text-blue-400" />
                                  </Button>
                                </span>
                              </TooltipTrigger>
                              <TooltipContent>
                                {peutConsulter
                                  ? "Voir le détail"
                                  : "Accès non autorisé"}
                              </TooltipContent>
                            </Tooltip>
                            {peutConsulter && f.chemin_fichier ? (
                              <AlertDialog>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <AlertDialogTrigger asChild>
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        disabled={
                                          telechargementEnCours ===
                                          f.reference
                                        }
                                      >
                                        {telechargementEnCours ===
                                        f.reference ? (
                                          <Loader2 className="size-4 animate-spin text-emerald-600 dark:text-emerald-400" />
                                        ) : (
                                          <FileDown className="size-4 text-emerald-600 dark:text-emerald-400" />
                                        )}
                                      </Button>
                                    </AlertDialogTrigger>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    {peutConsulter
                                      ? "Télécharger le fichier"
                                      : "Accès non autorisé"}
                                  </TooltipContent>
                                </Tooltip>
                                <AlertDialogContent size="sm">
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>
                                      Télécharger la fiche
                                    </AlertDialogTitle>
                                    <AlertDialogDescription>
                                      Voulez-vous télécharger le fichier Excel
                                      de la fiche {f.reference} ?
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>
                                      Annuler
                                    </AlertDialogCancel>
                                    <AlertDialogAction
                                      onClick={() => handleTelecharger(f)}
                                    >
                                      Télécharger
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            ) : (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <span className="inline-flex">
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      disabled
                                    >
                                      <FileDown className="size-4 text-emerald-600 dark:text-emerald-400" />
                                    </Button>
                                  </span>
                                </TooltipTrigger>
                                <TooltipContent>
                                  {!peutConsulter
                                    ? "Accès non autorisé"
                                    : "Fichier indisponible"}
                                </TooltipContent>
                              </Tooltip>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {}
        <div className="flex flex-col gap-4">
          {peutGenerer && (
            <Card className="border-none bg-gradient-to-br from-primary to-accent text-primary-foreground shadow-[0_10px_25px_-5px_rgba(15,23,42,0.35)] ring-0">
              <CardContent className="relative">
                <div className="pointer-events-none absolute -right-8 -top-8 size-28 rounded-full border-[14px] border-white/10" />
                <span className="mb-3.5 flex size-10 items-center justify-center rounded-xl bg-white/15">
                  <Zap className="size-[18px]" strokeWidth={2.2} />
                </span>
                <p className="font-heading text-[15.5px] font-bold">
                  Générer une fiche de dépôt
                </p>
                <p className="mb-4 mt-1.5 text-xs leading-relaxed text-primary-foreground/80">
                  Lancez une nouvelle génération de fiche de dépôt en
                  quelques clics.
                </p>
                <Button
                  onClick={() => navigate("/dr/generer")}
                  className="w-full bg-white text-primary hover:bg-white/90"
                >
                  Démarrer
                </Button>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader className="pb-1">
              <CardTitle>Accès rapides</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-1">
              {peutGenerer && (
                <button
                  onClick={() => navigate("/dr/generer")}
                  className="flex items-center gap-3 rounded-xl border border-transparent px-2 py-2.5 text-sm font-medium text-foreground/80 transition-all duration-150 hover:border-border hover:bg-muted active:scale-[0.98]"
                >
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <FilePlus className="size-4" />
                  </span>
                  <span className="flex-1 text-left">
                    Générer une fiche de dépôt
                  </span>
                  <ChevronRight className="size-4 text-muted-foreground" />
                </button>
              )}
              <button
                onClick={() => navigate("/dr/fiches-depenses")}
                className="flex items-center gap-3 rounded-xl border border-transparent px-2 py-2.5 text-sm font-medium text-foreground/80 transition-all duration-150 hover:border-border hover:bg-muted active:scale-[0.98]"
              >
                <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Clock className="size-4" />
                </span>
                <span className="flex-1 text-left">Fiche de dépôt</span>
                <ChevronRight className="size-4 text-muted-foreground" />
              </button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

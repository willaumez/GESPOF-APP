import { useEffect, useState, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { toast } from "sonner";
import {
  CalendarDays,
  Check,
  Sparkles,
  Zap,
  Loader2,
  TriangleAlert,
} from "lucide-react";
import { cn } from "@/shared/lib/utils";
import { API_CONFIG } from "@/shared/config/app";
import { SERVICE_REGLEMENT_ENDPOINTS } from "@/portails/Sr/api/endpoints";
import { lireJeton } from "@/shared/lib/auth-stockage";
import { useAuth } from "@/shared/hooks/use-auth";
import { useIsMobile } from "@/shared/hooks/use-mobile";
import { formatMontant } from "@/shared/lib/format";
import { Badge } from "@/shared/components/ui/badge";
import { Button } from "@/shared/components/ui/button";
import { Card, CardTitle } from "@/shared/components/ui/card";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/shared/components/ui/input-group";
import { Label } from "@/shared/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/shared/components/ui/dialog";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/shared/components/ui/resizable";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/shared/components/ui/table";
import type {
  ResultatGenerationFiche,
  FicheNonValidee,
} from "@/portails/Sr/types";

const STEPS = [
  {
    nom: "RÉCUPÉRATION DES LOTS DE DÉPENSES",
    desc: "Chargement des lots enregistrés pour la date sélectionnée.",
  },
  {
    nom: "RECHERCHE DES RÈGLEMENTS MANQUANTS",
    desc: "Détection des règlements absents ou incomplets.",
  },
  {
    nom: "RECHERCHE DES DESIGNATIONS",
    desc: "Association des libellés et désignations aux lignes de dépenses.",
  },
  {
    nom: "AGRÉGATION DES RÈGLEMENTS",
    desc: "Regroupement des règlements par nature et bénéficiaire.",
  },
  {
    nom: "CRÉATION DE LA FICHE DE DEPOT",
    desc: "Génération du document consolidé de la journée.",
  },
  {
    nom: "VALIDATION DE LA FICHE DE DEPOT",
    desc: "Contrôles de cohérence puis validation finale.",
  },
  {
    nom: "VISUALISATION DE LA FICHE DE DEPOT",
    desc: "Ouverture de la fiche générée.",
  },
];

export default function GenererFiche() {
  const location = useLocation();
  const navigate = useNavigate();
  const { hasRole } = useAuth();
  const peutGenerer = hasRole("AGENT_SR");
  const isMobile = useIsMobile();

  const [date, setDate] = useState(
    (location.state as { date?: string } | null)?.date ??
      new Date().toISOString().split("T")[0],
  );
  const dateFormatee = date
    ? format(new Date(date), "EEEE d MMMM yyyy", { locale: fr })
    : null;

  const [isGenerating, setIsGenerating] = useState(false);
  const [percentage, setPercentage] = useState(0);
  const [currentStep, setCurrentStep] = useState(0);
  const [stepMessage, setStepMessage] = useState("");
  const [isComplete, setIsComplete] = useState(false);
  const [ficheNonValidee, setFicheNonValidee] =
    useState<FicheNonValidee | null>(null);

  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  const genererFiche = async () => {
    if (!date || isGenerating || !peutGenerer) return;

    setIsGenerating(true);
    setPercentage(0);
    setCurrentStep(0);
    setStepMessage("Démarrage...");
    setIsComplete(false);
    setFicheNonValidee(null);

    try {
      abortControllerRef.current = new AbortController();

      const jeton = lireJeton();
      const response = await fetch(
        `${API_CONFIG.BASE_URL}${SERVICE_REGLEMENT_ENDPOINTS.FICHE_GENERER_PROGRESS}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "text/event-stream",
            ...(jeton ? { Authorization: `Bearer ${jeton}` } : {}),
          },
          body: JSON.stringify({ date }),
          signal: abortControllerRef.current.signal,
        },
      );

      if (!response.ok) {
        throw new Error(`Erreur HTTP: ${response.status}`);
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) {
        throw new Error("Impossible de lire le flux");
      }

      let buffer = "";
      let currentEvent = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (line.startsWith("event: ")) {
            currentEvent = line.slice(7).trim();
            continue;
          }

          if (line.startsWith("data: ")) {
            let data;
            try {
              data = JSON.parse(line.slice(6));
            } catch (e) {
              console.error("Erreur de parsing SSE:", e);
              continue;
            }

            console.log(`[${currentEvent}]`, data);

            if (currentEvent === "progress") {
              setPercentage(data.percentage);
              setStepMessage(data.step);

              const stepIndex = Math.floor(
                (data.percentage / 100) * STEPS.length,
              );
              setCurrentStep(Math.min(stepIndex, STEPS.length - 1));

              if (data.percentage === 100) {
                setIsComplete(true);
              }
            } else if (currentEvent === "result") {
              const resultat = data as ResultatGenerationFiche;
              setIsGenerating(false);

              if (!resultat.valide) {
                toast.warning(
                  "Montants non correspondants : la fiche n'a pas été créée.",
                );
                setFicheNonValidee(resultat);
                return;
              }

              toast.success(
                `fiche de dépôt générée pour le ${dateFormatee}.`,
              );
              navigate(`/sr/fiche/${encodeURIComponent(resultat.reference)}`);
              return;
            } else if (currentEvent === "message") {
              toast.warning(data.message || "Aucune donnée pour cette date.");
              setIsGenerating(false);
              return;
            } else if (currentEvent === "error") {
              throw new Error(data.message || "Erreur lors du traitement");
            }
          }
        }
      }
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        console.log("Génération annulée");
        return;
      }

      console.error("Erreur:", error);
      toast.error(
        error instanceof Error
          ? error.message
          : "Erreur lors de la génération de la fiche.",
      );
    } finally {
      setIsGenerating(false);
      abortControllerRef.current = null;
    }
  };

  const connecteurEtat = (idxCible: number): "done" | "active" | "pending" => {
    if (isComplete || (isGenerating && idxCible < currentStep)) return "done";
    if (isGenerating && idxCible === currentStep) return "active";
    return "pending";
  };

  const statutTexte = isGenerating
    ? `${Math.round(percentage)}% — en cours`
    : ficheNonValidee
      ? "Non validée"
      : isComplete
        ? "Terminé"
        : "En attente";
  const statutClasse = isGenerating
    ? "text-primary"
    : ficheNonValidee
      ? "text-destructive"
      : isComplete
        ? "text-accent"
        : "text-muted-foreground";

  const colonneGauche = (
    <div className="flex h-full flex-col gap-6 p-6 sm:p-8">
      <div className="flex items-center gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary ring-1 ring-primary/15">
          <Sparkles className="size-4" />
        </span>
        <div>
          <p className="text-[10.5px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            Génération
          </p>
          <CardTitle>FICHE DE DEPOT</CardTitle>
        </div>
      </div>

      <p className="text-[13px] leading-relaxed text-muted-foreground">
        Sélectionnez la date de traitement puis lancez le processus.
      </p>

      <div>
        <Label
          htmlFor="date-generation"
          className="mb-1.5 text-[10.5px] font-semibold uppercase tracking-[0.1em] text-muted-foreground"
        >
          Date de traitement
        </Label>
        <InputGroup className="h-11 bg-background">
          <InputGroupAddon>
            <CalendarDays className="size-4" />
          </InputGroupAddon>
          <InputGroupInput
            id="date-generation"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                genererFiche();
              }
            }}
            disabled={isGenerating}
            className="min-w-0"
          />
        </InputGroup>
        {dateFormatee && (
          <p className="mt-1.5 text-[12px] text-muted-foreground">
            Journée du{" "}
            <span className="font-medium text-foreground">{dateFormatee}</span>
          </p>
        )}
      </div>

      {}
      <div className="space-y-2.5 md:mt-auto">
        <Button
          variant="outline"
          size="lg"
          disabled={isGenerating || !date || !peutGenerer}
          onClick={genererFiche}
          className={cn(
            "relative h-auto min-h-12 w-full overflow-hidden border-2 border-primary bg-primary/8 py-2 text-[13.5px] font-semibold text-primary",
            "transition-all hover:-translate-y-0.5 hover:border-primary hover:bg-primary/15 hover:shadow-md hover:shadow-primary/15 active:translate-y-0 active:scale-[0.98]",
            "disabled:border-primary/25 disabled:bg-primary/5 disabled:text-primary/40 disabled:hover:translate-y-0 disabled:hover:shadow-none",
          )}
        >
          <span
            className="absolute inset-y-0 left-0 bg-primary/20 transition-all duration-300 ease-out"
            style={{
              width: isGenerating
                ? `${percentage}%`
                : isComplete
                  ? "100%"
                  : "0%",
            }}
          />
          <span className="relative z-10 flex w-full min-w-0 flex-col items-center justify-center gap-1.5 py-1">
            {isGenerating ? (
              <>
                <div className="relative flex size-12 shrink-0 items-center justify-center">
                  <span
                    className="absolute inset-0 animate-spin rounded-full border-[3px] border-muted border-t-primary"
                    style={{ animationDuration: "1s" }}
                  />
                  <span
                    className="absolute inset-[5px] animate-spin rounded-full border-[3px] border-muted border-b-primary"
                    style={{
                      animationDuration: "0.8s",
                      animationDirection: "reverse",
                    }}
                  />
                  <span className="text-[11px] font-bold text-primary">
                    {Math.round(percentage)}%
                  </span>
                </div>
                <span className="text-center text-[11px] font-medium text-primary/70">
                  {stepMessage || "Traitement en cours…"}
                </span>
              </>
            ) : isComplete ? (
              <Badge variant="default" className="gap-1.5 text-sm">
                ✓ 100%
              </Badge>
            ) : (
              <>
                <span className="flex w-full flex-wrap items-center justify-center gap-2 text-center">
                  <Zap className="size-4 shrink-0" />
                  <span className="min-w-0 whitespace-normal">
                    {!peutGenerer
                      ? "Génération non autorisée"
                      : dateFormatee
                        ? "Commencer la génération de la fiche"
                        : "Sélectionnez une date pour commencer"}
                  </span>
                </span>
                {peutGenerer && dateFormatee && (
                  <span className="text-center text-[11px] font-normal text-primary/70">
                    des dépenses du {dateFormatee}
                  </span>
                )}
              </>
            )}
          </span>
        </Button>
        {!peutGenerer ? (
          <p className="text-center text-[11px] text-destructive">
            Vous n'avez pas les droits nécessaires pour générer une fiche de
            dépenses.
          </p>
        ) : (
          <p className="text-center text-[11px] text-muted-foreground">
            Le traitement s'exécute pour la journée sélectionnée uniquement.
          </p>
        )}
      </div>
    </div>
  );

  const colonneDroite = (
    <div className="flex h-full flex-col gap-5 p-6 sm:p-8">
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
        <p className="text-[10.5px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
          Déroulement du processus
        </p>
        <span
          className={cn(
            "text-[11.5px] font-semibold transition-colors duration-500",
            statutClasse,
          )}
        >
          {statutTexte}
        </span>
      </div>

      <div className="flex flex-col">
        {STEPS.map((step, idx) => {
          const isDone = isComplete || (isGenerating && idx < currentStep);
          const isActive = isGenerating && idx === currentStep;
          const isError = Boolean(ficheNonValidee) && idx === currentStep;
          const isLast = idx === STEPS.length - 1;
          const connecteur = !isLast ? connecteurEtat(idx + 1) : null;

          return (
            <div key={step.nom} className="flex gap-3.5">
              {}
              <div className="flex shrink-0 flex-col items-center">
                <div
                  className={cn(
                    "relative flex size-9 shrink-0 items-center justify-center rounded-full border-2 text-[12px] font-bold transition-colors duration-500",
                    isError
                      ? "border-destructive bg-destructive text-destructive-foreground"
                      : isDone
                        ? "border-accent bg-accent text-accent-foreground"
                        : isActive
                          ? "border-primary bg-background text-primary shadow-[0_0_0_4px_rgba(15,23,42,0.12)]"
                          : "border-border bg-background text-muted-foreground",
                  )}
                >
                  {isActive && (
                    <span className="absolute -inset-0.5 animate-ping rounded-full bg-primary/20" />
                  )}
                  {isError ? (
                    <TriangleAlert
                      className="relative size-4"
                      strokeWidth={2.8}
                    />
                  ) : isDone ? (
                    <Check className="relative size-4" strokeWidth={2.8} />
                  ) : isActive ? (
                    <Loader2 className="relative size-4 animate-spin" />
                  ) : (
                    <span className="relative">{idx + 1}</span>
                  )}
                </div>
                {!isLast && (
                  <div
                    aria-hidden="true"
                    className={cn(
                      "my-1 w-0.5 min-h-6 flex-1 rounded-full transition-colors duration-500",
                      connecteur === "done" && "bg-accent/55",
                      connecteur === "active" &&
                        "connector-flow-v text-primary",
                      connecteur === "pending" &&
                        "connector-dashed-v text-border",
                    )}
                  />
                )}
              </div>

              <div className={cn("min-w-0", isLast ? "pb-1" : "pb-5")}>
                <p
                  className={cn(
                    "pt-1.5 text-[11.5px] leading-snug font-semibold tracking-wide transition-colors duration-500",
                    isError
                      ? "text-destructive"
                      : isActive
                        ? "text-primary"
                        : isDone
                          ? "text-foreground"
                          : "text-muted-foreground",
                  )}
                >
                  {step.nom}
                </p>
                <p className="mt-0.5 text-[11.5px] leading-snug text-muted-foreground">
                  {step.desc}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );

  const lignesNonValidee = ficheNonValidee
    ? [...ficheNonValidee.lignes].sort((a, b) => {
        const aEcart = a.montant_systac !== a.montant_groupe;
        const bEcart = b.montant_systac !== b.montant_groupe;
        return aEcart === bEcart ? 0 : aEcart ? -1 : 1;
      })
    : [];

  return (
    <div className="space-y-5">
      <Card className="gap-0 overflow-hidden py-0 shadow-sm">
        {isMobile ? (
          <div className="flex flex-col divide-y divide-border">
            {colonneGauche}
            {colonneDroite}
          </div>
        ) : (
          <ResizablePanelGroup orientation="horizontal">
            <ResizablePanel
              defaultSize="550px"
              minSize="400px"
              maxSize="740px"
              className="border-r border-border"
            >
              {colonneGauche}
            </ResizablePanel>
            <ResizableHandle withHandle />
            <ResizablePanel minSize="400px">{colonneDroite}</ResizablePanel>
          </ResizablePanelGroup>
        )}
      </Card>

      {}
      <Dialog
        open={!!ficheNonValidee}
        onOpenChange={(open) => !open && setFicheNonValidee(null)}
      >
        <DialogContent className="flex max-h-[92vh] w-full max-w-[95vw] flex-col overflow-hidden sm:max-w-5xl">
          <DialogHeader className="shrink-0">
            <div className="flex items-center gap-3">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-destructive/10 text-destructive">
                <TriangleAlert className="size-4" />
              </span>
              <div>
                <DialogTitle className="flex items-center gap-2">
                  Fiche non validée
                  <Badge variant="destructive" className="font-normal">
                    Non validé
                  </Badge>
                </DialogTitle>
                <p className="mt-0.5 text-[12px] text-muted-foreground">
                  {ficheNonValidee?.message}
                </p>
              </div>
            </div>
          </DialogHeader>

          <div className="flex shrink-0 flex-wrap items-center justify-center gap-4 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 sm:gap-6">
            <div className="text-center">
              <p className="text-[11px] text-muted-foreground">
                Montant Systac
              </p>
              <p className="text-lg font-bold tabular-nums text-foreground">
                {formatMontant(
                  String(ficheNonValidee?.total_montant_systac ?? 0),
                )}{" "}
                FCFA
              </p>
            </div>
            <TriangleAlert className="size-5 shrink-0 text-destructive" />
            <div className="text-center">
              <p className="text-[11px] text-muted-foreground">
                Montant groupé
              </p>
              <p className="text-lg font-bold tabular-nums text-foreground">
                {formatMontant(
                  String(ficheNonValidee?.total_montant_groupe ?? 0),
                )}{" "}
                FCFA
              </p>
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-hidden rounded-lg border">
            <Table containerClassName="min-h-0 max-h-[60vh] overflow-auto">
              <TableHeader className="sticky top-0 z-10 bg-muted">
                <TableRow className="bg-muted hover:bg-muted">
                  <TableHead className="whitespace-nowrap">N° BV</TableHead>
                  <TableHead className="min-w-[220px]">Désignation</TableHead>
                  <TableHead className="whitespace-nowrap text-right">
                    Nb Régl.
                  </TableHead>
                  <TableHead className="whitespace-nowrap text-right">
                    Montant Systac
                  </TableHead>
                  <TableHead className="whitespace-nowrap text-right">
                    Montant Groupé
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {lignesNonValidee.map((l, i) => {
                  const ecart = l.montant_systac !== l.montant_groupe;
                  return (
                    <TableRow
                      key={i}
                      className={
                        ecart
                          ? "bg-destructive/10 hover:bg-destructive/15"
                          : undefined
                      }
                    >
                      <TableCell className="whitespace-nowrap text-muted-foreground">
                        {l.n_bv}
                      </TableCell>
                      <TableCell
                        className="max-w-[380px] truncate text-muted-foreground"
                        title={l.designation}
                      >
                        {l.designation}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-right tabular-nums text-muted-foreground">
                        {l.nb_regl}
                      </TableCell>
                      <TableCell
                        className={cn(
                          "whitespace-nowrap text-right font-medium tabular-nums",
                          ecart ? "text-destructive" : "text-foreground",
                        )}
                      >
                        {formatMontant(String(l.montant_systac))}
                      </TableCell>
                      <TableCell
                        className={cn(
                          "whitespace-nowrap text-right tabular-nums",
                          ecart
                            ? "font-medium text-destructive"
                            : "text-muted-foreground",
                        )}
                      >
                        {formatMontant(String(l.montant_groupe))}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>

          <DialogFooter className="shrink-0">
            <Button variant="outline" onClick={() => setFicheNonValidee(null)}>
              Fermer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

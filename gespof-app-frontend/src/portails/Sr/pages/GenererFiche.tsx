import { useEffect, useRef, useState, type CSSProperties } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { toast } from "sonner";
import {
  CalendarDays,
  Check,
  Eye,
  FileText,
  Loader2,
  TriangleAlert,
  Wrench,
  Zap,
} from "lucide-react";
import { cn } from "@/shared/lib/utils";
import { API_CONFIG } from "@/shared/config/app";
import { SERVICE_REGLEMENT_ENDPOINTS } from "@/portails/Sr/api/endpoints";
import { lireJeton } from "@/shared/lib/auth-stockage";
import { useAuth } from "@/shared/hooks/use-auth";
import { useIsMobile } from "@/shared/hooks/use-mobile";
import { formatMontant } from "@/shared/lib/format";
import { getPortalMenu } from "@/shared/config/menu";
import { Badge } from "@/shared/components/ui/badge";
import { Button } from "@/shared/components/ui/button";
import { BoutonAcces } from "@/shared/components/ui/bouton-acces";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/shared/components/ui/input-group";
import { Label } from "@/shared/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/shared/components/ui/dialog";
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
import {
  ficheRecuePourDate,
  fichesRecuesRecentes,
  detailFicheRecue,
} from "@/portails/Sr/api/fiches-recues";
import type { FicheRecueSp } from "@/portails/Sr/types/notification.interface";
import { PreviewFicheBleueDialog } from "@/portails/Sp/components/fiche-matinale/PreviewFicheBleueDialog";

const theme = getPortalMenu("sr").theme;

/** Sélecteur de Fiche Bleue réservé au développement (à retirer plus tard). */
const OUTIL_DEV_FICHE_BLEUE = import.meta.env.DEV;
const VALEUR_FICHE_RECUE = "fiche-recue";

const STEPS = [
  {
    nom: "Récupération des lots",
    desc: "Chargement des lots enregistrés pour la date sélectionnée.",
  },
  {
    nom: "Règlements manquants",
    desc: "Détection des règlements absents ou incomplets.",
  },
  {
    nom: "Désignations",
    desc: "Association des libellés aux lignes de dépenses.",
  },
  {
    nom: "Agrégation",
    desc: "Regroupement des règlements par nature et bénéficiaire.",
  },
  {
    nom: "Création de la fiche",
    desc: "Génération du document consolidé de la journée.",
  },
  {
    nom: "Enregistrement",
    desc: "Persistance de la fiche (les écarts Systac seront contrôlés à l'envoi SP).",
  },
  {
    nom: "Visualisation",
    desc: "Ouverture de la fiche générée.",
  },
];

export default function GenererFiche() {
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { hasAcces } = useAuth();
  const peutGenerer = hasAcces("GENERER_FICHE_DEPOT");
  const isMobile = useIsMobile();

  const dateInitiale =
    searchParams.get("date") ??
    (location.state as { date?: string } | null)?.date ??
    new Date().toISOString().split("T")[0];

  const [date, setDate] = useState(dateInitiale);
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
  const [ficheRecue, setFicheRecue] = useState<FicheRecueSp | null>(null);
  const [chargementFicheRecue, setChargementFicheRecue] = useState(false);
  /** DEV : fiche forcée ; prioritaire sur la fiche reçue pour la génération. */
  const [ficheDev, setFicheDev] = useState<FicheRecueSp | null>(null);
  const [fichesDev, setFichesDev] = useState<FicheRecueSp[]>([]);
  const ficheEnvoyee = ficheDev ?? ficheRecue;
  const [apercuFicheBleueId, setApercuFicheBleueId] = useState<number | null>(
    null,
  );

  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort();
    };
  }, []);

  useEffect(() => {
    if (!date) {
      setFicheRecue(null);
      return;
    }
    let annule = false;
    setChargementFicheRecue(true);
    void ficheRecuePourDate(date)
      .then((page) => {
        if (!annule) setFicheRecue(page.fiche);
      })
      .catch(() => {
        if (!annule) setFicheRecue(null);
      })
      .finally(() => {
        if (!annule) setChargementFicheRecue(false);
      });
    return () => {
      annule = true;
    };
  }, [date]);

  useEffect(() => {
    if (!OUTIL_DEV_FICHE_BLEUE) return;
    let annule = false;
    void fichesRecuesRecentes()
      .then(({ fiches }) => {
        if (!annule) setFichesDev(fiches);
      })
      .catch(() => {
        if (!annule) setFichesDev([]);
      });
    return () => {
      annule = true;
    };
  }, []);

  const genererFiche = async () => {
    if (!date || isGenerating || !peutGenerer) return;

    setIsGenerating(true);
    setPercentage(0);
    setCurrentStep(0);
    setStepMessage("Démarrage…");
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
          body: JSON.stringify({
            date,
            ...(ficheEnvoyee ? { fiche_bleue_id: ficheEnvoyee.id } : {}),
          }),
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
            let data: Record<string, unknown>;
            try {
              data = JSON.parse(line.slice(6)) as Record<string, unknown>;
            } catch {
              continue;
            }

            if (currentEvent === "progress") {
              const pct = Number(data.percentage) || 0;
              setPercentage(pct);
              setStepMessage(String(data.step ?? ""));
              const stepIndex = Math.floor((pct / 100) * STEPS.length);
              setCurrentStep(Math.min(stepIndex, STEPS.length - 1));
              if (pct === 100) setIsComplete(true);
            } else if (currentEvent === "result") {
              const resultat = data as unknown as ResultatGenerationFiche;
              setIsGenerating(false);

              if (!resultat.valide) {
                toast.warning(
                  "Montants non correspondants : la fiche n'a pas été créée.",
                );
                setFicheNonValidee(resultat);
                return;
              }

              toast.success(
                `Fiche de dépôt générée pour le ${dateFormatee}.`,
              );
              navigate(`/sr/fiche/${encodeURIComponent(resultat.reference)}`);
              return;
            } else if (currentEvent === "message") {
              toast.warning(
                String(data.message || "Aucune donnée pour cette date."),
              );
              setIsGenerating(false);
              return;
            } else if (currentEvent === "error") {
              throw new Error(
                String(data.message || "Erreur lors du traitement"),
              );
            }
          }
        }
      }
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") return;

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
    ? `${Math.round(percentage)} % — en cours`
    : ficheNonValidee
      ? "Non validée"
      : isComplete
        ? "Terminé"
        : "En attente";

  const styleHero: CSSProperties = {
    background: `
      radial-gradient(120% 80% at 100% 0%, ${theme.topColor}18 0%, transparent 55%),
      linear-gradient(135deg, ${theme.bgColor} 0%, #ffffff 48%, ${theme.bgColor} 100%)
    `,
    borderColor: `${theme.topColor}33`,
  };

  const stylePanneau: CSSProperties = {
    borderColor: `${theme.topColor}28`,
  };

  const lignesNonValidee = ficheNonValidee
    ? [...ficheNonValidee.lignes].sort((a, b) => {
        const aEcart = a.montant_systac !== a.montant_groupe;
        const bEcart = b.montant_systac !== b.montant_groupe;
        return aEcart === bEcart ? 0 : aEcart ? -1 : 1;
      })
    : [];

  const panneauControles = (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex flex-1 flex-col gap-5 p-5 sm:p-6">
        <div>
          <Label
            htmlFor="date-generation"
            className="mb-1.5 text-[11.5px] font-medium text-muted-foreground"
          >
            Date de traitement
          </Label>
          <InputGroup
            className="h-11 border-2 bg-white"
            style={{ borderColor: `${theme.topColor}33` }}
          >
            <InputGroupAddon>
              <CalendarDays
                className="size-4"
                style={{ color: theme.iconColor }}
              />
            </InputGroupAddon>
            <InputGroupInput
              id="date-generation"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  void genererFiche();
                }
              }}
              disabled={isGenerating}
              className="min-w-0 font-semibold tabular-nums"
            />
          </InputGroup>
          {dateFormatee ? (
            <p className="mt-2 text-[13px] text-muted-foreground">
              Journée du{" "}
              <span className="font-semibold capitalize text-[#0f172a]">
                {dateFormatee}
              </span>
            </p>
          ) : null}
        </div>

        <div
          className="rounded-xl border-2 px-3.5 py-3"
          style={{
            borderColor: `${theme.topColor}22`,
            background: theme.bgColor,
          }}
        >
          <p
            className="mb-1.5 text-[11px] font-semibold tracking-[0.1em] uppercase"
            style={{ color: theme.iconColor }}
          >
            Dépenses reçues du SP
          </p>
          {chargementFicheRecue ? (
            <p className="flex items-center gap-1.5 text-[13px] text-muted-foreground">
              <Loader2 className="size-3.5 animate-spin" />
              Recherche de la fiche du jour…
            </p>
          ) : ficheRecue ? (
            <div className="flex items-center justify-between gap-2">
              <p className="flex min-w-0 items-center gap-1.5 text-[13px] text-[#0f172a]">
                <FileText
                  className="size-3.5 shrink-0"
                  style={{ color: theme.iconColor }}
                />
                <span className="min-w-0 truncate font-mono text-[12.5px] font-semibold">
                  {ficheRecue.reference}
                </span>
                <span className="shrink-0 tabular-nums text-muted-foreground">
                  · {formatMontant(ficheRecue.montant_total_programme)} FCFA
                </span>
              </p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 shrink-0 gap-1.5 border-2 bg-white"
                style={{ borderColor: `${theme.topColor}40` }}
                onClick={() => setApercuFicheBleueId(ficheRecue.id)}
              >
                <Eye className="size-3.5" />
                Aperçu
              </Button>
            </div>
          ) : (
            <p className="text-[13px] text-muted-foreground">
              Aucune dépense reçue pour cette date. La génération reste
              possible.
            </p>
          )}
        </div>

        {OUTIL_DEV_FICHE_BLEUE ? (
          <div className="rounded-xl border-2 border-dashed border-amber-400 bg-amber-50 px-3.5 py-3">
            <p className="mb-1.5 flex items-center gap-1.5 text-[11px] font-medium text-amber-800">
              <Wrench className="size-3" />
              Fiche Bleue envoyée avec la fiche de dépôt
              <span className="rounded bg-amber-200 px-1 text-[9.5px] font-bold tracking-wide uppercase">
                Dev
              </span>
            </p>
            <div className="flex items-center gap-2">
              <Select
                value={ficheDev ? String(ficheDev.id) : VALEUR_FICHE_RECUE}
                onValueChange={(valeur) => {
                  setFicheDev(
                    valeur === VALEUR_FICHE_RECUE
                      ? null
                      : (fichesDev.find((f) => String(f.id) === valeur) ?? null),
                  );
                }}
                disabled={isGenerating}
              >
                <SelectTrigger className="h-9 min-w-0 flex-1 border-amber-300 bg-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={VALEUR_FICHE_RECUE}>
                    Dépenses reçues du SP
                    {ficheRecue ? ` · ${ficheRecue.reference}` : " · aucune fiche"}
                  </SelectItem>
                  {fichesDev.map((f) => (
                    <SelectItem key={f.id} value={String(f.id)}>
                      {f.reference}
                      {f.journee_date ? ` · journée du ${f.journee_date}` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {ficheDev ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-9 shrink-0 gap-1.5 border-amber-300 bg-white"
                  onClick={() => setApercuFicheBleueId(ficheDev.id)}
                >
                  <Eye className="size-3.5" />
                  Aperçu
                </Button>
              ) : null}
            </div>
            <p className="mt-1.5 text-[11.5px] text-amber-800/80">
              {ficheDev
                ? `La génération utilisera ${ficheDev.reference} (${formatMontant(ficheDev.montant_total_programme)} FCFA) au lieu des dépenses reçues.`
                : "Par défaut, la génération utilise la fiche des dépenses reçues ci-dessus."}
            </p>
          </div>
        ) : null}
      </div>

      <div
        className="mt-auto shrink-0 space-y-2 border-t px-5 py-4 sm:px-6"
        style={{
          borderColor: `${theme.topColor}18`,
          background: `linear-gradient(180deg, ${theme.bgColor}88 0%, #ffffff 100%)`,
        }}
      >
        <BoutonAcces
          acces="GENERER_FICHE_DEPOT"
          size="lg"
          disabled={isGenerating || !date}
          onClick={() => void genererFiche()}
          className={cn(
            "relative h-auto min-h-12 w-full overflow-hidden py-2.5 text-[14px] font-semibold text-white shadow-md",
            "hover:opacity-95 disabled:opacity-50",
          )}
          style={{ background: theme.ctaColor }}
        >
          <span
            className="absolute inset-y-0 left-0 bg-white/20 transition-all duration-300 ease-out"
            style={{
              width: isGenerating
                ? `${percentage}%`
                : isComplete
                  ? "100%"
                  : "0%",
            }}
          />
          <span className="relative z-10 flex w-full min-w-0 flex-col items-center justify-center gap-1.5 py-0.5">
            {isGenerating ? (
              <>
                <div className="relative flex size-12 shrink-0 items-center justify-center">
                  <span
                    className="absolute inset-0 animate-spin rounded-full border-[3px] border-white/25 border-t-white"
                    style={{ animationDuration: "1s" }}
                  />
                  <span className="text-[12px] font-bold tabular-nums">
                    {Math.round(percentage)}%
                  </span>
                </div>
                <span className="text-center text-[11.5px] font-medium text-white/85">
                  {stepMessage || "Traitement en cours…"}
                </span>
              </>
            ) : isComplete ? (
              <span className="flex items-center gap-2">
                <Check className="size-4" strokeWidth={2.5} />
                Génération terminée
              </span>
            ) : (
              <>
                <span className="flex items-center gap-2">
                  <Zap className="size-4 shrink-0" strokeWidth={2.2} />
                  {!peutGenerer
                    ? "Génération non autorisée"
                    : dateFormatee
                      ? "Lancer la génération"
                      : "Sélectionnez une date"}
                </span>
                {peutGenerer && dateFormatee ? (
                  <span className="text-center text-[11.5px] font-normal text-white/80">
                    Fiche de dépôt du {dateFormatee}
                  </span>
                ) : null}
              </>
            )}
          </span>
        </BoutonAcces>
        {!peutGenerer ? (
          <p className="text-center text-[12px] text-destructive">
            Vous n&apos;avez pas les droits pour générer une fiche de dépôt.
          </p>
        ) : (
          <p className="text-center text-[12px] text-muted-foreground">
            Le traitement s&apos;exécute pour la journée sélectionnée
            uniquement.
          </p>
        )}
      </div>
    </div>
  );

  const panneauEtapes = (
    <div className="flex h-full flex-col gap-4 p-5 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-[15px] font-bold text-[#0f172a]">
            Déroulement
          </h2>
          <p className="text-[12.5px] text-muted-foreground">
            Sept étapes de génération
          </p>
        </div>
        <span
          className={cn(
            "rounded-full px-2.5 py-1 text-[11.5px] font-semibold tabular-nums",
            isGenerating && "bg-sky-100 text-sky-900",
            ficheNonValidee && "bg-rose-100 text-rose-800",
            isComplete && !ficheNonValidee && "bg-emerald-100 text-emerald-800",
            !isGenerating &&
              !ficheNonValidee &&
              !isComplete &&
              "bg-slate-100 text-slate-600",
          )}
        >
          {statutTexte}
        </span>
      </div>

      {isGenerating ? (
        <div
          className="h-1.5 overflow-hidden rounded-full"
          style={{ background: `${theme.topColor}18` }}
        >
          <div
            className="h-full rounded-full transition-all duration-300 ease-out"
            style={{
              width: `${percentage}%`,
              background: theme.ctaColor,
            }}
          />
        </div>
      ) : null}

      <div className="flex flex-col">
        {STEPS.map((step, idx) => {
          const isDone = isComplete || (isGenerating && idx < currentStep);
          const isActive = isGenerating && idx === currentStep;
          const isError = Boolean(ficheNonValidee) && idx === currentStep;
          const isLast = idx === STEPS.length - 1;
          const connecteur = !isLast ? connecteurEtat(idx + 1) : null;

          return (
            <div key={step.nom} className="flex gap-3.5">
              <div className="flex shrink-0 flex-col items-center">
                <div
                  className={cn(
                    "relative flex size-9 shrink-0 items-center justify-center rounded-full border-2 text-[12px] font-bold transition-colors duration-500",
                    isError &&
                      "border-destructive bg-destructive text-destructive-foreground",
                    !isError &&
                      isDone &&
                      "border-emerald-600 bg-emerald-600 text-white",
                    !isError &&
                      !isDone &&
                      isActive &&
                      "bg-white shadow-[0_0_0_4px_rgba(7,96,168,0.15)]",
                    !isError &&
                      !isDone &&
                      !isActive &&
                      "border-border bg-white text-muted-foreground",
                  )}
                  style={
                    !isError && isActive
                      ? { borderColor: theme.ctaColor, color: theme.ctaColor }
                      : undefined
                  }
                >
                  {isActive ? (
                    <span
                      className="absolute -inset-0.5 animate-ping rounded-full opacity-30"
                      style={{ background: theme.ctaColor }}
                    />
                  ) : null}
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
                {!isLast ? (
                  <div
                    aria-hidden
                    className={cn(
                      "my-1 w-0.5 min-h-5 flex-1 rounded-full transition-colors duration-500",
                      connecteur === "done" && "bg-emerald-500/55",
                      connecteur === "active" && "bg-sky-400/60",
                      connecteur === "pending" && "bg-border",
                    )}
                  />
                ) : null}
              </div>

              <div className={cn("min-w-0", isLast ? "pb-1" : "pb-4")}>
                <p
                  className={cn(
                    "pt-1.5 text-[13px] font-semibold leading-snug transition-colors duration-500",
                    isError && "text-destructive",
                    !isError && isActive && "text-[#0f172a]",
                    !isError && !isActive && isDone && "text-[#0f172a]",
                    !isError &&
                      !isActive &&
                      !isDone &&
                      "text-muted-foreground",
                  )}
                  style={
                    !isError && isActive ? { color: theme.iconColor } : undefined
                  }
                >
                  {step.nom}
                </p>
                <p className="mt-0.5 text-[12px] leading-snug text-muted-foreground">
                  {step.desc}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );

  return (
    <div className="flex w-full flex-col gap-5 pb-2 sm:gap-6">
      {/* Héros */}
      <section
        className="relative overflow-hidden rounded-2xl border-2 px-5 py-5 sm:px-7 sm:py-6"
        style={styleHero}
      >
        <div
          className="pointer-events-none absolute -right-16 -top-20 size-56 rounded-full opacity-40"
          style={{ background: theme.iconBg }}
          aria-hidden
        />
        <div className="relative flex flex-col gap-1">
          <p
            className="text-[11px] font-semibold tracking-[0.14em] uppercase"
            style={{ color: theme.iconColor }}
          >
            Génération
          </p>
          <h2 className="font-heading text-[1.35rem] font-bold tracking-tight text-[#0f172a] sm:text-[1.55rem]">
            Fiche de dépôt
          </h2>
          <p className="max-w-xl text-[13.5px] leading-relaxed text-muted-foreground">
            Choisissez la date de traitement, vérifiez les dépenses reçues du
            SP, puis lancez le processus.
          </p>
        </div>
      </section>

      {/* Corps : contrôles + étapes */}
      <section
        className={cn(
          "overflow-hidden rounded-2xl border-2 bg-card",
          isMobile
            ? "flex flex-col divide-y"
            : "grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] lg:items-stretch",
        )}
        style={stylePanneau}
      >
        <div
          className={cn(
            "flex min-h-0 flex-col",
            !isMobile && "border-r lg:min-h-full",
          )}
          style={!isMobile ? { borderColor: `${theme.topColor}18` } : undefined}
        >
          {panneauControles}
        </div>
        <div
          className="min-h-0"
          style={{ background: `${theme.bgColor}66` }}
        >
          {panneauEtapes}
        </div>
      </section>

      <Dialog
        open={!!ficheNonValidee}
        onOpenChange={(open) => !open && setFicheNonValidee(null)}
      >
        <DialogContent className="flex max-h-[calc(100dvh-2rem)] w-full max-w-[95vw] flex-col overflow-hidden sm:max-w-5xl">
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

      <PreviewFicheBleueDialog
        ficheId={apercuFicheBleueId}
        onClose={() => setApercuFicheBleueId(null)}
        chargerDetail={detailFicheRecue}
        portail="sr"
      />
    </div>
  );
}

import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { toast } from "sonner";
import {
  CalendarDays,
  Check,
  Eye,
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
import { SrPageHeader } from "@/portails/Sr/components/layout/SrPageHeader";

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

  const lignesNonValidee = ficheNonValidee
    ? [...ficheNonValidee.lignes].sort((a, b) => {
        const aEcart = a.montant_systac !== a.montant_groupe;
        const bEcart = b.montant_systac !== b.montant_groupe;
        return aEcart === bEcart ? 0 : aEcart ? -1 : 1;
      })
    : [];

  const panneauEtapes = (
    <div className="flex flex-col rounded-lg border border-[#e2e8f0] bg-white p-[18px]">
      {STEPS.map((step, idx) => {
        const isDone = isComplete || (isGenerating && idx < currentStep);
        const isActive =
          (!isGenerating && !isComplete && idx === 0) ||
          (isGenerating && idx === currentStep) ||
          (isComplete && idx === STEPS.length - 1);
        const isError = Boolean(ficheNonValidee) && idx === currentStep;
        const isLast = idx === STEPS.length - 1;
        const connecteur = !isLast ? connecteurEtat(idx + 1) : null;

        return (
          <div key={step.nom} className="flex gap-3.5">
            <div className="flex shrink-0 flex-col items-center">
              <span
                className={cn(
                  "grid size-[30px] shrink-0 place-items-center rounded-full border-[1.5px] text-[13px] font-semibold transition-colors",
                  isError &&
                    "border-destructive bg-destructive text-white",
                  !isError &&
                    (isDone || isActive) &&
                    "border-transparent text-white",
                  !isError &&
                    !isDone &&
                    !isActive &&
                    "border-[#cbd5e1] bg-white text-[#64748b]",
                )}
                style={
                  !isError && (isDone || isActive)
                    ? { background: theme.ctaColor, borderColor: theme.ctaColor }
                    : undefined
                }
              >
                {isError ? (
                  <TriangleAlert className="size-3.5" strokeWidth={2.5} />
                ) : isDone ? (
                  <Check className="size-3.5" strokeWidth={2.8} />
                ) : isActive && isGenerating ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  idx + 1
                )}
              </span>
              {!isLast ? (
                <span
                  aria-hidden
                  className="my-1 w-0.5 min-h-[30px] flex-1"
                  style={{
                    background:
                      connecteur === "done" || connecteur === "active"
                        ? theme.ctaColor
                        : "#e2e8f0",
                  }}
                />
              ) : null}
            </div>
            <div
              className={cn(
                "flex min-w-0 flex-col gap-0.5 pt-1",
                isLast ? "pb-1" : "pb-[22px]",
              )}
            >
              <span
                className={cn(
                  "text-[14.5px] leading-snug",
                  isError && "font-semibold text-destructive",
                  !isError && isActive && "font-semibold text-[#0f172a]",
                  !isError && !isActive && "font-medium text-[#475569]",
                )}
              >
                {step.nom}
              </span>
              <span className="text-[12.5px] leading-snug text-[#64748b]">
                {step.desc}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );

  const panneauControles = (
    <div className="flex min-w-0 flex-1 flex-col rounded-lg border border-[#e2e8f0] bg-white">
      <div className="flex flex-col gap-5 p-6">
        <div className="flex flex-col gap-1">
          <span
            className="text-[19px] font-semibold text-[#0f172a]"
            style={{ fontFamily: '"IBM Plex Serif", "IBM Plex Sans", serif' }}
          >
            Date de présentation
          </span>
          <span className="text-sm text-[#475569]">
            La fiche sera rattachée à la journée de trésorerie ouverte par le SP
            pour cette date.
          </span>
        </div>

        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label
              htmlFor="date-generation"
              className="text-[13px] font-semibold text-[#334155]"
            >
              Date de présentation
            </Label>
            <InputGroup className="h-[42px] max-w-md border border-[#cbd5e1] bg-white">
              <InputGroupAddon>
                <CalendarDays className="size-4 text-[#64748b]" />
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
                className="min-w-0 tabular-nums text-[#0f172a]"
              />
            </InputGroup>
            {dateFormatee ? (
              <p className="text-[13px] capitalize text-[#64748b]">
                {dateFormatee}
              </p>
            ) : null}
          </div>

          <div className="flex flex-col gap-1.5">
            <Label className="text-[13px] font-semibold text-[#334155]">
              Dépenses reçues du SP
            </Label>
            <div className="flex h-[42px] max-w-md items-center justify-between gap-2 rounded-md border border-[#e2e8f0] bg-[#f8fafc] px-3">
              {chargementFicheRecue ? (
                <span className="flex items-center gap-1.5 text-[13px] text-[#64748b]">
                  <Loader2 className="size-3.5 animate-spin" />
                  Recherche…
                </span>
              ) : ficheRecue ? (
                <>
                  <span
                    className="min-w-0 truncate font-mono text-[13px] text-[#0f172a]"
                    style={{
                      fontFamily: '"IBM Plex Mono", ui-monospace, monospace',
                    }}
                  >
                    {ficheRecue.reference}
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 shrink-0 gap-1 px-2 text-[12.5px]"
                    onClick={() => setApercuFicheBleueId(ficheRecue.id)}
                  >
                    <Eye className="size-3.5" />
                    Aperçu
                  </Button>
                </>
              ) : (
                <span className="text-[13px] text-[#64748b]">Aucune</span>
              )}
            </div>
          </div>
        </div>

        {OUTIL_DEV_FICHE_BLEUE ? (
          <div className="rounded-lg border border-dashed border-amber-400 bg-amber-50 px-3.5 py-3">
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
          </div>
        ) : null}

        {isGenerating || isComplete || ficheNonValidee ? (
          <div
            className={cn(
              "rounded-md border px-3.5 py-3 text-[13.5px]",
              ficheNonValidee && "border-rose-200 bg-rose-50 text-rose-800",
              isComplete &&
                !ficheNonValidee &&
                "border-emerald-200 bg-emerald-50 text-emerald-800",
              isGenerating &&
                !ficheNonValidee &&
                "border-[#e2e8f0] bg-[#f8fafc] text-[#334155]",
            )}
          >
            {statutTexte}
            {stepMessage ? ` — ${stepMessage}` : ""}
            {isGenerating ? (
              <div
                className="mt-2 h-1.5 overflow-hidden rounded-full"
                style={{ background: `${theme.topColor}18` }}
              >
                <div
                  className="h-full rounded-full transition-all duration-300"
                  style={{
                    width: `${percentage}%`,
                    background: theme.ctaColor,
                  }}
                />
              </div>
            ) : null}
          </div>
        ) : null}
      </div>

      <div className="mt-auto flex flex-wrap items-center justify-between gap-3 border-t border-[#e2e8f0] bg-[#f8fafc] px-6 py-3.5">
        <span className="text-[13px] text-[#64748b]">
          {!peutGenerer
            ? "Génération non autorisée pour votre profil."
            : "Le traitement s'exécute pour la journée sélectionnée uniquement."}
        </span>
        <BoutonAcces
          acces="GENERER_FICHE_DEPOT"
          disabled={isGenerating || !date}
          onClick={() => void genererFiche()}
          className={cn(
            "relative h-[38px] min-w-[180px] overflow-hidden px-4 text-sm font-semibold text-white",
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
          <span className="relative z-10 flex items-center gap-2">
            {isGenerating ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                {Math.round(percentage)}%
              </>
            ) : isComplete ? (
              <>
                <Check className="size-4" strokeWidth={2.5} />
                Terminé
              </>
            ) : (
              <>
                <Zap className="size-4" strokeWidth={2.2} />
                Lancer la génération
              </>
            )}
          </span>
        </BoutonAcces>
      </div>
    </div>
  );

  const stepLabel =
    isGenerating || isComplete
      ? STEPS[currentStep]?.nom ?? "Préparation"
      : "Récupération des lots";

  return (
    <div className="flex w-full flex-col gap-6">
      <SrPageHeader
        eyebrow={`Pool SR · Génération · ${stepLabel}`}
        title="Générer une fiche de dépôt"
        description="Consolidez les règlements du jour (Systac, Sigma, Numéraire) et transmettez la fiche au Service de Prévision."
      />

      {/* Maquette : étapes à gauche, contenu à droite */}
      <section
        className={cn(
          "flex items-start gap-5",
          isMobile ? "flex-col" : "flex-wrap",
        )}
      >
        <div
          className={cn(
            "w-full",
            !isMobile && "max-w-[340px] flex-[0_1_340px]",
          )}
        >
          {panneauEtapes}
        </div>
        <div className="min-w-0 flex-[1_1_480px]">{panneauControles}</div>
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

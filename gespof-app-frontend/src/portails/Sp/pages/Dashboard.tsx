import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import {
  Archive,
  ArrowDownRight,
  ArrowUpRight,
  CheckCircle2,
  CircleAlert,
  Clock,
  Database,
  FileText,
  Info,
  Inbox,
  Loader2,
  LockOpen,
  RefreshCw,
  RotateCw,
  Sunrise,
} from "lucide-react";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/shared/hooks/use-auth";
import { getPortalMenu } from "@/shared/config/menu";
import { formatMontant } from "@/shared/lib/format";
import { messageDonneesOuDefaut } from "@/shared/lib/message-utilisateur";
import { cn } from "@/shared/lib/utils";
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
import { Skeleton } from "@/shared/components/ui/skeleton";
import { DrawerPositionTresorerie } from "@/portails/Sp/components/dashboard/DrawerPositionTresorerie";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/shared/components/ui/table";
import { resumeTableauBord } from "@/portails/Sp/api/dashboard";
import {
  cloturerJourneeTresorerie,
  creerJourneeTresorerie,
  reouvrirJourneeTresorerie,
} from "@/portails/Sp/api/journees-tresorerie";
import { useJourneeSelectionnee } from "@/portails/Sp/hooks/journee-selectionnee";
import { formaterDateSeuleMatinale } from "@/shared/lib/format-date-heure";
import type {
  LigneDepenseDashboard,
  LigneRecetteDashboard,
  SourceTableauDashboard,
  StatutDepenseDashboard,
  StatutRecetteDashboard,
  TableauBordSp,
} from "@/portails/Sp/types/dashboard.interface";

type StatutBadge = "success" | "warning" | "danger" | "info";

const HAUTEUR_LIGNE_PX = 40;

const BADGE_CLASS: Record<StatutBadge, string> = {
  success: "border-transparent bg-emerald-100 text-emerald-800",
  warning: "border-transparent bg-amber-100 text-amber-800",
  danger: "border-transparent bg-rose-100 text-rose-800",
  info: "border-transparent bg-sky-100 text-sky-800",
};

const BADGE_RECETTE: Record<StatutRecetteDashboard, StatutBadge> = {
  valide: "success",
  partiel: "warning",
  manuel: "warning",
  en_attente: "danger",
};

const BADGE_DEPENSE: Record<StatutDepenseDashboard, StatutBadge> = {
  payee: "success",
  partielle: "warning",
  urgence: "warning",
  en_attente: "danger",
};

const LIBELLE_SOURCE: Record<SourceTableauDashboard, string> = {
  fiche_execution: "Fiche d'exécution",
  fiche_bleue: "Fiche Bleue",
};

function formaterMontantFcfa(
  valeur: string | number | null | undefined,
): string {
  if (valeur == null) return "—";
  return formatMontant(String(valeur));
}

function formaterCompact(valeur: string): string {
  const n = Number(valeur.replace(",", "."));
  if (!Number.isFinite(n)) return "—";
  if (Math.abs(n) >= 1_000_000_000) {
    return `${(n / 1_000_000_000).toLocaleString("fr-FR", {
      minimumFractionDigits: 1,
      maximumFractionDigits: 1,
    })} Mds`;
  }
  return formaterMontantFcfa(valeur);
}

function formaterHeureIso(iso: string | null | undefined): string {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  const hh = String(date.getHours()).padStart(2, "0");
  const mm = String(date.getMinutes()).padStart(2, "0");
  return `${hh}h${mm}`;
}

function formaterDateFr(iso: string | null | undefined): string {
  if (!iso) return "—";
  const [y, m, d] = iso.split("-");
  if (!y || !m || !d) {
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return iso;
    return date.toLocaleDateString("fr-FR");
  }
  return `${d}/${m}/${y}`;
}

function prefixeSigne(
  variante: "recette" | "depense" | undefined,
  valeur: string,
): string {
  if (variante === "recette") return `+ ${valeur}`;
  if (variante === "depense") return `- ${valeur}`;
  return valeur;
}

function useLignesRemplissage(nbLignesReelles: number) {
  const ref = useRef<HTMLDivElement>(null);
  const [complement, setComplement] = useState(0);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const mesurer = () => {
      const thead = el.querySelector("thead");
      const hautThead = thead instanceof HTMLElement ? thead.offsetHeight : 0;
      const capacite = Math.max(
        0,
        Math.floor((el.clientHeight - hautThead) / HAUTEUR_LIGNE_PX),
      );
      const occupees = Math.max(nbLignesReelles, 1);
      setComplement(Math.max(0, capacite - occupees));
    };

    mesurer();
    const observateur = new ResizeObserver(mesurer);
    observateur.observe(el);
    return () => observateur.disconnect();
  }, [nbLignesReelles]);

  return { ref, complement };
}

function LignesVides({
  nombre,
  colonnes,
}: {
  nombre: number;
  colonnes: number;
}) {
  if (nombre <= 0) return null;
  return (
    <>
      {Array.from({ length: nombre }).map((_, i) => (
        <TableRow key={`vide-${i}`} className="hover:bg-transparent">
          <TableCell colSpan={colonnes} className="h-10 border-border/50 p-0" />
        </TableRow>
      ))}
    </>
  );
}

function TableauRecettes({
  chargement,
  source,
  lignes,
}: {
  chargement: boolean;
  source: string | null;
  lignes: LigneRecetteDashboard[];
}) {
  const nbReelles = chargement ? 6 : lignes.length;
  const { ref, complement } = useLignesRemplissage(nbReelles);

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-2xl border bg-card shadow-sm">
      <div className="flex shrink-0 items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="flex items-center gap-2 text-[13.5px] font-semibold text-foreground">
          <ArrowUpRight className="size-4 text-emerald-600" />
          Recettes
        </span>
        <span className="flex items-center gap-1.5 text-[11.5px] text-muted-foreground">
          <CheckCircle2 className="size-3.5 text-emerald-600" />
          {source ?? "—"}
        </span>
      </div>
      <div ref={ref} className="min-h-0 flex-1 overflow-auto">
        <Table containerClassName="overflow-visible">
          <TableHeader className="sticky top-0 z-10 bg-card">
            <TableRow className="hover:bg-transparent">
              <TableHead>Libellé</TableHead>
              <TableHead className="text-right">Réalisé</TableHead>
              <TableHead className="text-right">Statut</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {chargement ? (
              Array.from({ length: 6 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell>
                    <Skeleton className="h-4 w-40" />
                  </TableCell>
                  <TableCell className="text-right">
                    <Skeleton className="ml-auto h-4 w-24" />
                  </TableCell>
                  <TableCell className="text-right">
                    <Skeleton className="ml-auto h-5 w-16" />
                  </TableCell>
                </TableRow>
              ))
            ) : lignes.length === 0 ? (
              <TableRow className="hover:bg-transparent">
                <TableCell
                  colSpan={3}
                  className="h-10 text-center text-[13px] text-muted-foreground"
                >
                  Aucune recette pour cette journée.
                </TableCell>
              </TableRow>
            ) : (
              lignes.map((ligne, index) => (
                <TableRow key={`${ligne.libelle}-${index}`}>
                  <TableCell className="font-medium">{ligne.libelle}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formaterMontantFcfa(ligne.montant)}
                  </TableCell>
                  <TableCell className="text-right">
                    <Badge className={BADGE_CLASS[BADGE_RECETTE[ligne.statut]]}>
                      {ligne.statut_libelle}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))
            )}
            <LignesVides nombre={chargement ? 0 : complement} colonnes={3} />
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

function TableauDepenses({
  chargement,
  source,
  lignes,
}: {
  chargement: boolean;
  source: string | null;
  lignes: LigneDepenseDashboard[];
}) {
  const nbReelles = chargement ? 6 : lignes.length;
  const { ref, complement } = useLignesRemplissage(nbReelles);

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-2xl border bg-card shadow-sm">
      <div className="flex shrink-0 items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="flex items-center gap-2 text-[13.5px] font-semibold text-foreground">
          <ArrowDownRight className="size-4 text-rose-600" />
          Dépenses
        </span>
        <span className="flex items-center gap-1.5 text-[11.5px] text-muted-foreground">
          <RotateCw className="size-3.5" />
          {source ?? "—"}
        </span>
      </div>
      <div ref={ref} className="min-h-0 flex-1 overflow-auto">
        <Table containerClassName="overflow-visible">
          <TableHeader className="sticky top-0 z-10 bg-card">
            <TableRow className="hover:bg-transparent">
              <TableHead>Libellé</TableHead>
              <TableHead className="text-right">Réalisé</TableHead>
              <TableHead className="text-right">Statut</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {chargement ? (
              Array.from({ length: 6 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell>
                    <Skeleton className="h-4 w-44" />
                  </TableCell>
                  <TableCell className="text-right">
                    <Skeleton className="ml-auto h-4 w-24" />
                  </TableCell>
                  <TableCell className="text-right">
                    <Skeleton className="ml-auto h-5 w-16" />
                  </TableCell>
                </TableRow>
              ))
            ) : lignes.length === 0 ? (
              <TableRow className="hover:bg-transparent">
                <TableCell
                  colSpan={3}
                  className="h-10 text-center text-[13px] text-muted-foreground"
                >
                  Aucune dépense pour cette journée.
                </TableCell>
              </TableRow>
            ) : (
              lignes.map((ligne, index) => (
                <TableRow
                  key={`${ligne.libelle}-${index}`}
                  className={cn(ligne.hors_programme && "bg-amber-50/70")}
                >
                  <TableCell className="max-w-[220px]">
                    <span
                      className={cn(
                        "font-medium",
                        ligne.hors_programme && "font-semibold",
                      )}
                    >
                      {ligne.libelle}
                    </span>
                    {ligne.hors_programme && (
                      <span className="ml-1.5 text-[10.5px] font-medium text-rose-600">
                        (hors prog.)
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="text-right font-medium tabular-nums">
                    {formaterMontantFcfa(ligne.realise)}
                  </TableCell>
                  <TableCell className="text-right">
                    <Badge className={BADGE_CLASS[BADGE_DEPENSE[ligne.statut]]}>
                      {ligne.statut_libelle}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))
            )}
            <LignesVides nombre={chargement ? 0 : complement} colonnes={3} />
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

function EtatVideTableau({
  titre,
  message,
  action,
}: {
  titre: string;
  message: string;
  action?: ReactNode;
}) {
  const theme = getPortalMenu("sp").theme;

  return (
    <div
      className="flex min-h-0 min-w-0 flex-1 flex-col items-center justify-center gap-3 rounded-2xl border bg-card px-5 py-8 text-center shadow-sm"
      style={{ borderColor: `${theme.topColor}22` }}
    >
      <div
        className="flex size-11 items-center justify-center rounded-2xl"
        style={{ background: theme.iconBg, color: theme.iconColor }}
        aria-hidden
      >
        <Inbox className="size-5" />
      </div>
      <div className="max-w-md space-y-1.5">
        <p className="text-[14px] font-semibold text-foreground">{titre}</p>
        <p className="text-[13px] leading-relaxed text-muted-foreground">{message}</p>
      </div>
      {action}
    </div>
  );
}

/**
 * Tableau de bord SP — données de la journée de trésorerie.
 */
export default function Dashboard() {
  const theme = getPortalMenu("sp").theme;
  const navigate = useNavigate();
  const { hasAnyRole } = useAuth();
  // Le chef de service peut réouvrir toute journée ; un agent, seulement la dernière.
  const estChefService = hasAnyRole(["CHEF_SP"]);
  // Journée choisie dans la TopBar (null = journée du jour, résolue par le backend).
  const { reference: referenceSelectionnee, appliquerJournee } = useJourneeSelectionnee();
  const [data, setData] = useState<TableauBordSp | null>(null);
  const [chargement, setChargement] = useState(true);
  const [rafraichissement, setRafraichissement] = useState(false);
  const [ouvertureEnCours, setOuvertureEnCours] = useState(false);
  const [clotureEnCours, setClotureEnCours] = useState(false);
  const [dialogCloture, setDialogCloture] = useState(false);
  const [dialogReouverture, setDialogReouverture] = useState(false);
  const [reouvertureEnCours, setReouvertureEnCours] = useState(false);
  const [drawerPosition, setDrawerPosition] = useState(false);
  const [dernierRafraichissement, setDernierRafraichissement] = useState(
    () => new Date(),
  );

  const charger = useCallback(async (silencieux = false) => {
    if (!silencieux) setChargement(true);
    else setRafraichissement(true);
    try {
      const resume = await resumeTableauBord(null, referenceSelectionnee);
      setData(resume);
      setDernierRafraichissement(new Date());
    } catch (e) {
      toast.error(
        messageDonneesOuDefaut(
          e instanceof Error ? e.message : null,
          "Impossible de charger le tableau de bord.",
        ),
      );
    } finally {
      setChargement(false);
      setRafraichissement(false);
    }
  }, [referenceSelectionnee]);

  useEffect(() => {
    void charger();
  }, [charger]);

  const heureRafraichissement = (() => {
    const hh = String(dernierRafraichissement.getHours()).padStart(2, "0");
    const mm = String(dernierRafraichissement.getMinutes()).padStart(2, "0");
    return `${hh}h${mm}`;
  })();

  const journee = data?.journee ?? null;
  const journeeOuverte = journee != null;
  const journeeCloturee = journee?.etat === "cloture";
  const ind = data?.indicateurs;
  const variation = ind?.variation_ouverture_pct;
  const variationN = variation != null ? Number(variation) : null;
  const sourceRecettes = ind?.source_recettes
    ? LIBELLE_SOURCE[ind.source_recettes]
    : null;
  const sourceDepenses = ind?.source_depenses
    ? LIBELLE_SOURCE[ind.source_depenses]
    : null;

  const accentsCartes: CSSProperties[] = [
    { borderLeft: `4px solid ${theme.topColor}` },
    { borderTop: `4px solid ${theme.topColor}` },
    { borderTop: `4px solid ${theme.topColor}` },
    { borderRight: `4px solid ${theme.topColor}` },
  ];

  const indicateursAffiches = [
    {
      label: "Solde d'ouverture",
      valeur: ind?.solde_ouverture ?? "0",
      sousTitre:
        variationN != null && Number.isFinite(variationN)
          ? `${variationN > 0 ? "+" : ""}${variationN.toLocaleString("fr-FR")}% vs veille`
          : journeeOuverte
            ? "Journée en cours"
            : "Aucune journée ouverte",
      tendance: (variationN != null && variationN < 0 ? "down" : "up") as
        | "up"
        | "down",
    },
    {
      label: "Recettes (jour)",
      valeur: ind?.total_recettes ?? "0",
      sousTitre: sourceRecettes
        ? `${sourceRecettes} · ${ind?.nombre_postes_recettes ?? 0} poste${(ind?.nombre_postes_recettes ?? 0) > 1 ? "s" : ""}`
        : "Aucune source",
      variante: "recette" as const,
      tendance: "info" as const,
    },
    {
      label: "Dépenses (jour)",
      valeur: ind?.total_depenses ?? "0",
      sousTitre:
        Number(ind?.depenses_en_attente ?? 0) > 0
          ? `${formaterCompact(ind!.depenses_en_attente)} en attente`
          : "RAS",
      variante: "depense" as const,
      tendance:
        Number(ind?.depenses_en_attente ?? 0) > 0
          ? ("alerte" as const)
          : ("info" as const),
    },
    {
      label: "Solde de clôture estimé",
      valeur: ind?.solde_cloture ?? "0",
      sousTitre: ind?.solde_cloture_estime
        ? "Estimé (ouverture + recettes − dépenses)"
        : `Mise à jour ${formaterHeureIso(journee?.date_derniere_mise_a_jour)}`,
      tendance: "info" as const,
    },
  ];

  async function demarrerJournee() {
    setOuvertureEnCours(true);
    try {
      const { journee: creee } = await creerJourneeTresorerie();
      toast.success(`Journée ${creee.reference} ouverte.`);
      appliquerJournee(creee);
      await charger();
    } catch (e) {
      toast.error(
        e instanceof Error
          ? e.message
          : "Impossible d'ouvrir la journée de trésorerie.",
      );
    } finally {
      setOuvertureEnCours(false);
    }
  }

  async function confirmerReouverture() {
    if (!journee) return;
    setReouvertureEnCours(true);
    try {
      const { journee: reouverte } = await reouvrirJourneeTresorerie(journee.reference);
      appliquerJournee(reouverte);
      toast.success(`Journée ${journee.reference} réouverte.`);
      setDialogReouverture(false);
      await charger(true);
    } catch (e) {
      toast.error(
        messageDonneesOuDefaut(
          e instanceof Error ? e.message : null,
          "Impossible de réouvrir la journée.",
        ),
      );
    } finally {
      setReouvertureEnCours(false);
    }
  }

  async function confirmerCloture() {
    if (!journee) return;
    setClotureEnCours(true);
    try {
      const { journee: cloturee } = await cloturerJourneeTresorerie(journee.reference);
      appliquerJournee(cloturee);
      toast.success(`Journée ${journee.reference} clôturée.`);
      setDialogCloture(false);
      setDrawerPosition(false);
      await charger(true);
    } catch (e) {
      toast.error(
        messageDonneesOuDefaut(
          e instanceof Error ? e.message : null,
          "Impossible de clôturer la journée.",
        ),
      );
    } finally {
      setClotureEnCours(false);
    }
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-2">
        <Button
          type="button"
          variant="outline"
          onClick={() => void charger(true)}
          disabled={rafraichissement || chargement}
          className="group h-9 gap-2.5 rounded-xl border bg-card py-0 pr-3.5 pl-1.5 shadow-sm hover:bg-card hover:shadow-md"
          style={{ borderColor: `${theme.topColor}33` }}
          title="Actualiser les données de la journée"
          aria-label={`Actualiser — dernière mise à jour à ${heureRafraichissement}`}
        >
          <span
            className="flex size-6 shrink-0 items-center justify-center rounded-lg transition-transform duration-300 group-hover:rotate-45"
            style={{ background: theme.iconBg, color: theme.iconColor }}
          >
            <RefreshCw className={cn("size-3.5", rafraichissement && "animate-spin")} />
          </span>
          <span className="flex flex-col items-start leading-none">
            <span className="text-[12.5px] font-semibold text-foreground">
              {rafraichissement ? "Actualisation…" : "Actualiser"}
            </span>
            <span className="mt-[3px] text-[10.5px] font-normal text-muted-foreground">
              Mis à jour à <span className="tabular-nums">{heureRafraichissement}</span>
            </span>
          </span>
        </Button>
        {/* Journée clôturée : « Réouvrir » remplace le déclencheur « Clôturer » du tiroir. */}
        {journeeCloturee ? (
          <Button
            type="button"
            variant="outline"
            className="h-9 gap-2 rounded-xl px-3.5 text-[12.5px] font-semibold shadow-sm hover:shadow-md"
            style={{ borderColor: theme.topColor, color: theme.hoverColor }}
            disabled={chargement || reouvertureEnCours}
            onClick={() => setDialogReouverture(true)}
            title="Annuler la clôture de cette journée"
          >
            {reouvertureEnCours ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <LockOpen className="size-3.5" />
            )}
            Réouvrir la journée
          </Button>
        ) : (
          <DrawerPositionTresorerie
            ouvert={drawerPosition}
            onOuvertChange={setDrawerPosition}
            data={data}
            clotureEnCours={clotureEnCours}
            disabled={chargement || !journeeOuverte}
            onCloturer={() => {
              setDrawerPosition(false);
              setDialogCloture(true);
            }}
          />
        )}
      </div>

      <div className="grid shrink-0 grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {indicateursAffiches.map((item, index) => (
          <div
            key={item.label}
            className="rounded-2xl border bg-card px-5 py-4 shadow-sm"
            style={{
              borderColor: `${theme.topColor}22`,
              ...accentsCartes[index],
            }}
          >
            <p className="text-[10.5px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
              {item.label}
            </p>
            {chargement ? (
              <Skeleton className="mt-2 h-8 w-40" />
            ) : (
              <p
                className={cn(
                  "mt-1.5 font-heading text-[1.35rem] font-bold tabular-nums leading-tight sm:text-[1.55rem]",
                  item.variante === "recette" && "text-emerald-700",
                  item.variante === "depense" && "text-rose-700",
                  !item.variante && "text-foreground",
                )}
              >
                {prefixeSigne(item.variante, formaterMontantFcfa(item.valeur))}{" "}
                FCFA
              </p>
            )}
            <div className="mt-1.5 flex items-center gap-1.5 text-[12px] text-muted-foreground">
              {item.tendance === "up" && (
                <ArrowUpRight className="size-3.5 text-emerald-600" />
              )}
              {item.tendance === "down" && (
                <ArrowDownRight className="size-3.5 text-rose-600" />
              )}
              {item.tendance === "alerte" && (
                <CircleAlert className="size-3.5 text-amber-600" />
              )}
              {item.tendance === "info" && item.label.includes("Recettes") && (
                <Database
                  className="size-3.5"
                  style={{ color: theme.iconColor }}
                />
              )}
              {item.tendance === "info" && item.label.includes("clôture") && (
                <Clock className="size-3.5" />
              )}
              {chargement ? <Skeleton className="h-3 w-28" /> : item.sousTitre}
            </div>
          </div>
        ))}
      </div>

      {chargement || journeeOuverte ? (
        <>
          {chargement ? (
            <div
              className="flex min-h-0 flex-1 items-center justify-center rounded-2xl border bg-card px-4 py-8"
              style={{ borderColor: `${theme.topColor}22` }}
            >
              <div className="flex items-center gap-2 text-[13px] text-muted-foreground">
                <Loader2 className="size-5 animate-spin" />
                Chargement du tableau de bord…
              </div>
            </div>
          ) : (data?.recettes.length ?? 0) === 0 && (data?.depenses.length ?? 0) === 0 ? (
            <EtatVideTableau
              titre="Aucune recette ni dépense pour cette journée"
              message="Les tableaux s'affichent dès qu'une Fiche Bleue, une fiche de dépôt ou une fiche d'exécution alimente la journée."
              action={
                journee ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="mt-1"
                    onClick={() =>
                      void navigate(
                        `/sp/fiche-matinale/journee/${encodeURIComponent(journee.reference)}`,
                      )
                    }
                  >
                    Ouvrir la fiche matinale
                  </Button>
                ) : null
              }
            />
          ) : (
            <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 xl:grid-cols-2">
              {(data?.recettes.length ?? 0) > 0 ? (
                <TableauRecettes
                  chargement={false}
                  source={sourceRecettes}
                  lignes={data?.recettes ?? []}
                />
              ) : (
                <EtatVideTableau
                  titre="Aucune recette"
                  message="Aucune recette n'est encore enregistrée pour cette journée."
                />
              )}
              {(data?.depenses.length ?? 0) > 0 ? (
                <TableauDepenses
                  chargement={false}
                  source={sourceDepenses}
                  lignes={data?.depenses ?? []}
                />
              ) : (
                <EtatVideTableau
                  titre="Aucune dépense"
                  message="Aucune dépense n'est encore enregistrée pour cette journée."
                />
              )}
            </div>
          )}

          {journee ? (
            <div
              className="shrink-0 rounded-2xl border bg-card px-5 py-3 shadow-[0_-6px_16px_rgba(15,23,42,0.06)]"
              style={{ borderColor: `${theme.topColor}22` }}
            >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="flex items-center gap-2 text-[14.5px] font-semibold text-foreground">
                <Info className="size-4" style={{ color: theme.iconColor }} />
                Résumé de la journée
                {journee ? (
                  <span className="font-mono text-[12px] font-normal text-muted-foreground">
                    {journee.reference}
                  </span>
                ) : null}
              </h2>
              <div className="flex flex-wrap items-center gap-1.5">
                <Badge className={BADGE_CLASS.info}>
                  {chargement ? (
                    <Loader2 className="size-3 animate-spin" />
                  ) : (
                    <Clock className="size-3" />
                  )}
                  {journee
                    ? `${formaterHeureIso(journee.date_derniere_mise_a_jour)} · ${journee.etat_libelle}`
                    : "Pas de journée"}
                </Badge>
                {data?.resume.fiche_bleue.reference ? (
                  <Badge className={BADGE_CLASS.warning}>
                    <FileText className="size-3" />
                    {data.resume.fiche_bleue.reference}
                  </Badge>
                ) : null}
              </div>
            </div>

            {journeeCloturee ? (
            <>
            <div className="my-3 h-px bg-border" />

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <div className="flex flex-col gap-0.5">
                <span className="text-[10.5px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
                  Fiche bleue (matinale)
                </span>
                <span className="text-[13.5px] font-semibold text-foreground">
                  {chargement
                    ? "…"
                    : `${data?.resume.fiche_bleue.nombre_depenses ?? 0} dépense${(data?.resume.fiche_bleue.nombre_depenses ?? 0) > 1 ? "s" : ""} programmée${(data?.resume.fiche_bleue.nombre_depenses ?? 0) > 1 ? "s" : ""} · ${formaterCompact(data?.resume.fiche_bleue.montant_programme ?? "0")}`}
                </span>
              </div>
              <div className="flex flex-col gap-0.5">
                <span className="text-[10.5px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
                  Fiche des dépôts
                </span>
                <span className="text-[13.5px] font-semibold text-foreground">
                  {chargement
                    ? "…"
                    : `${data?.resume.fiches_depot.nombre ?? 0} fiche${(data?.resume.fiches_depot.nombre ?? 0) > 1 ? "s" : ""} · ${formaterCompact(data?.resume.fiches_depot.montant_total ?? "0")}`}
                </span>
              </div>
              <div className="flex flex-col gap-0.5">
                <span className="text-[10.5px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
                  Écarts à traiter
                </span>
                <span
                  className={cn(
                    "text-[13.5px] font-semibold",
                    (data?.resume.ecarts.nombre_hors_programme ?? 0) > 0
                      ? "text-rose-700"
                      : "text-foreground",
                  )}
                >
                  {chargement
                    ? "…"
                    : (data?.resume.ecarts.nombre_hors_programme ?? 0) > 0
                      ? `${data!.resume.ecarts.nombre_hors_programme} dépense${data!.resume.ecarts.nombre_hors_programme > 1 ? "s" : ""} hors programme`
                      : "Aucun écart hors programme"}
                </span>
              </div>
              <div className="flex flex-col gap-0.5">
                <span className="text-[10.5px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
                  Archivage
                </span>
                <span className="flex items-center gap-1.5 text-[13.5px] font-semibold text-foreground">
                  <Archive
                    className="size-3.5"
                    style={{ color: theme.iconColor }}
                  />
                  {chargement
                    ? "…"
                    : data?.resume.archivage.cloturee
                      ? `${formaterDateFr(data.resume.archivage.date)} archivé`
                      : "Journée non clôturée"}
                </span>
              </div>
            </div>
            </>
            ) : (
              // Journée pas encore clôturée : le résumé n'est pas encore définitif.
              <div
                className="mt-3 flex items-center gap-3 rounded-xl border px-3.5 py-2.5"
                style={{ borderColor: `${theme.topColor}33`, background: `${theme.topColor}0d` }}
                role="status"
              >
                <span className="relative flex size-2.5 shrink-0" aria-hidden>
                  <span
                    className="absolute inline-flex size-full animate-ping rounded-full opacity-60"
                    style={{ background: theme.ctaColor }}
                  />
                  <span
                    className="relative inline-flex size-2.5 rounded-full"
                    style={{ background: theme.ctaColor }}
                  />
                </span>
                <p className="text-[13px] leading-snug text-foreground">
                  <span className="font-semibold">Journée de trésorerie toujours en cours.</span>{" "}
                  <span className="text-muted-foreground">
                    Le résumé (fiche bleue, dépôts, écarts, archivage) sera disponible après la clôture.
                  </span>
                </p>
              </div>
            )}
          </div>
            ) : null}
        </>
      ) : (
        <div
          className="flex min-h-0 flex-1 items-center justify-center rounded-2xl border bg-card px-4 py-8"
          style={{ borderColor: `${theme.topColor}22` }}
        >
          <div className="mx-auto flex w-full max-w-xl flex-col items-center gap-5 text-center">
            <div
              className="flex size-12 items-center justify-center rounded-2xl"
              style={{ background: theme.iconBg, color: theme.iconColor }}
            >
              <Sunrise className="size-6" />
            </div>
            <div className="space-y-2">
              <p
                className="text-[11px] font-semibold tracking-[0.12em] uppercase"
                style={{ color: theme.iconColor }}
              >
                Journée de trésorerie
              </p>
              <p className="text-[13.5px] leading-relaxed text-foreground/75">
                Aucune journée de trésorerie n&apos;est ouverte
                aujourd&apos;hui. Démarrez-la pour suivre les recettes, les
                dépenses et le résumé de la journée.
              </p>
            </div>
            <Button
              type="button"
              size="lg"
              className="h-11 w-full max-w-md gap-2 px-4 text-[12px] font-semibold tracking-wide uppercase shadow-md transition-[transform,box-shadow] hover:-translate-y-0.5 hover:shadow-lg sm:h-12 sm:w-auto sm:px-8 sm:text-[13px]"
              style={{ background: theme.ctaColor, color: "#fff" }}
              disabled={ouvertureEnCours}
              onClick={() => void demarrerJournee()}
            >
              {ouvertureEnCours && <Loader2 className="size-4 animate-spin" />}
              Démarrer la journée trésorerie du{" "}
              {formaterDateSeuleMatinale(new Date())}
            </Button>
          </div>
        </div>
      )}

      <AlertDialog open={dialogReouverture} onOpenChange={setDialogReouverture}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Réouvrir la journée ?</AlertDialogTitle>
            <AlertDialogDescription>
              La clôture de la journée {journee?.reference} sera annulée : ses
              montants seront retirés de la fiche consolidée (semaine / mois /
              année) jusqu&apos;à la prochaine clôture, et la Fiche Bleue et la
              Fiche d&apos;exécution liées repasseront « En cours ».{" "}
              {estChefService
                ? "En tant que chef de service, vous pouvez réouvrir toute journée clôturée, y compris une journée antérieure."
                : "Seule la dernière journée de trésorerie peut être réouverte ; pour une journée antérieure, adressez-vous au chef de service."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={reouvertureEnCours}>
              Annuler
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={reouvertureEnCours}
              style={{ background: theme.ctaColor, color: "#fff" }}
              onClick={(e) => {
                e.preventDefault();
                void confirmerReouverture();
              }}
            >
              {reouvertureEnCours && <Loader2 className="size-4 animate-spin" />}
              Réouvrir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={dialogCloture} onOpenChange={setDialogCloture}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Clôturer la journée ?</AlertDialogTitle>
            <AlertDialogDescription>
              La journée {journee?.reference} sera archivée. Les montants
              réalisés de la Fiche d&apos;exécution alimenteront la fiche
              consolidée (semaine / mois / année). La Fiche Bleue et la Fiche
              d&apos;exécution liées seront également clôturées. Cette action
              n&apos;est pas réversible.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={clotureEnCours}>
              Annuler
            </AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={clotureEnCours}
              onClick={(e) => {
                e.preventDefault();
                void confirmerCloture();
              }}
            >
              {clotureEnCours && <Loader2 className="size-4 animate-spin" />}
              Clôturer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

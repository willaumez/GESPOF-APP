import { useCallback, useEffect, useState, type ReactNode } from "react";
import {
  AlertTriangle,
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  Info,
  Landmark,
  Loader2,
  LockOpen,
  RefreshCw,
  Scale,
  Sunrise,
  type LucideIcon,
} from "lucide-react";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/shared/hooks/use-auth";
import { getPortalMenu } from "@/shared/config/menu";
import { formatMontant } from "@/shared/lib/format";
import { messageDonneesOuDefaut } from "@/shared/lib/message-utilisateur";
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
import { Skeleton } from "@/shared/components/ui/skeleton";
import { DrawerPositionTresorerie } from "@/portails/Sp/components/dashboard/DrawerPositionTresorerie";
import { SpPageHeader } from "@/portails/Sp/components/layout/SpPageHeader";
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

const theme = getPortalMenu("sp").theme;

const TAG = {
  ok: { bg: "#ecfdf5", fg: "#047857" },
  warn: { bg: "#fffbeb", fg: "#b45309" },
  bad: { bg: "#fef2f2", fg: "#b91c1c" },
  info: { bg: "#eff6ff", fg: "#1d4ed8" },
  neu: { bg: "#f1f5f9", fg: "#475569" },
} as const;

const TAG_RECETTE: Record<StatutRecetteDashboard, keyof typeof TAG> = {
  valide: "ok",
  partiel: "warn",
  manuel: "warn",
  en_attente: "bad",
};

const TAG_DEPENSE: Record<StatutDepenseDashboard, keyof typeof TAG> = {
  payee: "ok",
  partielle: "warn",
  urgence: "warn",
  en_attente: "bad",
};

const LIBELLE_SOURCE: Record<SourceTableauDashboard, string> = {
  fiche_execution: "Fiche d'exécution",
  fiche_bleue: "Fiche Bleue",
};

function formaterMontantFcfa(valeur: string | number | null | undefined): string {
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

function formaterDateFrLongue(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso.includes("T") ? iso : `${iso}T12:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function Tag({
  k,
  children,
}: {
  k: keyof typeof TAG;
  children: string;
}) {
  const t = TAG[k];
  return (
    <span
      className="inline-block font-medium whitespace-nowrap"
      style={{
        fontSize: 12,
        padding: "2px 9px",
        borderRadius: 4,
        background: t.bg,
        color: t.fg,
      }}
    >
      {children}
    </span>
  );
}

function TableauLignes({
  titre,
  source,
  icon,
  iconColor,
  chargement,
  lignes,
  total,
  totalLabel,
  empty,
}: {
  titre: string;
  source: string;
  icon: ReactNode;
  iconColor: string;
  chargement: boolean;
  lignes: {
    key: string;
    libelle: string;
    montant: string;
    statut: string;
    tag: keyof typeof TAG;
    horsProg?: boolean;
  }[];
  total: string;
  totalLabel: string;
  empty: string;
}) {
  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-lg border border-[#e2e8f0] bg-white">
      <div
        className="flex shrink-0 items-center justify-between gap-3 border-b border-[#e2e8f0]"
        style={{ padding: "14px 18px" }}
      >
        <span className="flex items-center gap-2.5 text-[15px] font-semibold text-[#0f172a]">
          <span style={{ color: iconColor }} className="flex">
            {icon}
          </span>
          {titre}
        </span>
        <span className="text-[12.5px] text-[#64748b]">{source}</span>
      </div>
      <div
        className="grid shrink-0 border-b border-[#e2e8f0] bg-[#f8fafc] text-[11.5px] font-semibold uppercase tracking-[0.06em] text-[#64748b]"
        style={{
          gridTemplateColumns: "minmax(0,1fr) 150px 100px",
          gap: 12,
          padding: "9px 18px",
        }}
      >
        <span>Libellé</span>
        <span className="text-right">Réalisé</span>
        <span className="text-right">Statut</span>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        {chargement ? (
          Array.from({ length: 5 }).map((_, i) => (
            <div
              key={i}
              className="grid items-center border-b border-[#f1f5f9]"
              style={{
                gridTemplateColumns: "minmax(0,1fr) 150px 100px",
                gap: 12,
                minHeight: 44,
                padding: "0 18px",
              }}
            >
              <Skeleton className="h-4 w-40" />
              <Skeleton className="ml-auto h-4 w-24" />
              <Skeleton className="ml-auto h-5 w-16" />
            </div>
          ))
        ) : lignes.length === 0 ? (
          <div className="px-[18px] py-8 text-center text-sm text-[#64748b]">
            {empty}
          </div>
        ) : (
          lignes.map((l) => (
            <div
              key={l.key}
              className="grid items-center border-b border-[#f1f5f9] text-sm hover:bg-[#f8fafc]"
              style={{
                gridTemplateColumns: "minmax(0,1fr) 150px 100px",
                gap: 12,
                minHeight: 44,
                padding: "0 18px",
                background: l.horsProg ? "#fffbeb" : undefined,
              }}
            >
              <span className="flex min-w-0 flex-col leading-snug">
                <span className="font-medium text-[#0f172a]">{l.libelle}</span>
                {l.horsProg ? (
                  <span
                    className="font-semibold"
                    style={{ fontSize: 11.5, color: "#b45309" }}
                  >
                    Hors programme
                  </span>
                ) : null}
              </span>
              <span className="text-right tabular-nums">
                {formaterMontantFcfa(l.montant)}
              </span>
              <span className="justify-self-end">
                <Tag k={l.tag}>{l.statut}</Tag>
              </span>
            </div>
          ))
        )}
      </div>
      <div
        className="mt-auto grid shrink-0 items-center border-t border-[#e2e8f0] bg-[#f8fafc] text-sm font-semibold"
        style={{
          gridTemplateColumns: "minmax(0,1fr) 150px 100px",
          gap: 12,
          minHeight: 46,
          padding: "0 18px",
        }}
      >
        <span>{totalLabel}</span>
        <span className="text-right tabular-nums">
          {chargement ? "…" : formaterMontantFcfa(total)}
        </span>
        <span />
      </div>
    </div>
  );
}

export default function Dashboard() {
  const navigate = useNavigate();
  const { hasAnyRole } = useAuth();
  const estChefService = hasAnyRole(["CHEF_SP"]);
  const { reference: referenceSelectionnee, appliquerJournee } =
    useJourneeSelectionnee();

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

  const charger = useCallback(
    async (silencieux = false) => {
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
    },
    [referenceSelectionnee],
  );

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
    : "—";
  const sourceDepenses = ind?.source_depenses
    ? LIBELLE_SOURCE[ind.source_depenses]
    : "—";

  const eyebrow = journee
    ? `${journee.reference} · Journée du ${formaterDateFrLongue(journee.date)}`
    : `Service de Prévision · ${formaterDateSeuleMatinale(new Date())}`;

  const kpis: {
    l: string;
    v: string;
    s: string;
    hi: boolean;
    vc: string;
    Icon: LucideIcon;
    ic: string;
  }[] = [
    {
      l: "Solde d'ouverture",
      v: journeeOuverte ? formaterMontantFcfa(ind?.solde_ouverture) : "0",
      s:
        variationN != null && Number.isFinite(variationN)
          ? `${variationN > 0 ? "+" : ""}${variationN.toLocaleString("fr-FR")} % par rapport à la veille`
          : journeeOuverte
            ? "Journée en cours"
            : "Aucune journée ouverte",
      hi: false,
      vc: theme.textColor,
      Icon: Landmark,
      ic: theme.textColor,
    },
    {
      l: "Recettes du jour",
      v: journeeOuverte
        ? `+ ${formaterMontantFcfa(ind?.total_recettes)}`
        : "+ 0",
      s: journeeOuverte
        ? `${sourceRecettes} · ${ind?.nombre_postes_recettes ?? 0} poste${(ind?.nombre_postes_recettes ?? 0) > 1 ? "s" : ""}`
        : "Aucune source",
      hi: false,
      vc: "#047857",
      Icon: ArrowUpRight,
      ic: "#047857",
    },
    {
      l: "Dépenses du jour",
      v: journeeOuverte
        ? `− ${formaterMontantFcfa(ind?.total_depenses)}`
        : "− 0",
      s:
        Number(ind?.depenses_en_attente ?? 0) > 0
          ? `${formaterCompact(ind!.depenses_en_attente)} en attente`
          : journeeOuverte
            ? "RAS"
            : "RAS",
      hi: false,
      vc: "#b91c1c",
      Icon: ArrowDownRight,
      ic: "#b91c1c",
    },
    {
      l: "Solde de clôture estimé",
      v: journeeOuverte ? formaterMontantFcfa(ind?.solde_cloture) : "0",
      s: "Ouverture + recettes − dépenses",
      hi: true,
      vc: "#0f172a",
      Icon: Scale,
      ic: theme.textColor,
    },
  ];

  const recettesLignes = (data?.recettes ?? []).map(
    (l: LigneRecetteDashboard, i) => ({
      key: `r-${i}`,
      libelle: l.libelle,
      montant: l.montant,
      statut: l.statut_libelle,
      tag: TAG_RECETTE[l.statut],
    }),
  );

  const depensesLignes = (data?.depenses ?? []).map(
    (l: LigneDepenseDashboard, i) => ({
      key: `d-${i}`,
      libelle: l.libelle,
      montant: l.realise,
      statut: l.statut_libelle,
      tag: TAG_DEPENSE[l.statut],
      horsProg: l.hors_programme,
    }),
  );

  const resume = data?.resume;
  const resumeItems = [
    {
      l: "Fiche Bleue (matinale)",
      v: resume?.fiche_bleue.reference ?? "—",
      s: resume
        ? `${resume.fiche_bleue.nombre_depenses} dépense${resume.fiche_bleue.nombre_depenses > 1 ? "s" : ""} programmée${resume.fiche_bleue.nombre_depenses > 1 ? "s" : ""} · ${formaterCompact(resume.fiche_bleue.montant_programme)}`
        : "—",
      c: "#0f172a",
    },
    {
      l: "Fiche des dépôts",
      v: resume
        ? `${resume.fiches_depot.nombre} fiche${resume.fiches_depot.nombre > 1 ? "s" : ""} reçue${resume.fiches_depot.nombre > 1 ? "s" : ""}`
        : "—",
      s: resume
        ? `${formaterCompact(resume.fiches_depot.montant_total)}`
        : "—",
      c: "#0f172a",
    },
    {
      l: "Écarts à traiter",
      v:
        (resume?.ecarts.nombre_hors_programme ?? 0) > 0
          ? `${resume!.ecarts.nombre_hors_programme} dépense hors programme`
          : "Aucun écart",
      s:
        (resume?.ecarts.nombre_hors_programme ?? 0) > 0
          ? formaterCompact(resume!.ecarts.montant_ecart)
          : "RAS",
      c:
        (resume?.ecarts.nombre_hors_programme ?? 0) > 0
          ? "#b91c1c"
          : "#0f172a",
    },
    {
      l: "Archivage",
      v: resume?.archivage.cloturee
        ? `Archivée le ${
            resume.archivage.date
              ? formaterDateSeuleMatinale(new Date(resume.archivage.date))
              : "—"
          }`
        : "Journée non clôturée",
      s: resume?.archivage.cloturee
        ? "Fiche consolidée mise à jour"
        : "Disponible après la clôture",
      c: "#0f172a",
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
      const { journee: reouverte } = await reouvrirJourneeTresorerie(
        journee.reference,
      );
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
      const { journee: cloturee } = await cloturerJourneeTresorerie(
        journee.reference,
      );
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

  const resumeBloc =
    (chargement || journeeOuverte) && (journee || chargement) ? (
      <div
        className="flex shrink-0 flex-col rounded-lg border border-[#e2e8f0] bg-white"
        style={{
          boxShadow: "0 -6px 16px rgba(15, 23, 42, 0.06)",
        }}
      >
        <div
          className="flex flex-wrap items-center justify-between gap-3 border-b border-[#e2e8f0]"
          style={{ padding: "14px 18px" }}
        >
          <span className="flex items-center gap-2.5 text-[15px] font-semibold text-[#0f172a]">
            <span className="flex" style={{ color: theme.topColor }}>
              <Info size={18} />
            </span>
            Résumé de la journée
            {journee ? (
              <span
                className="font-normal text-[#64748b]"
                style={{
                  fontFamily: '"IBM Plex Mono", ui-monospace, monospace',
                  fontSize: 12,
                }}
              >
                {journee.reference}
              </span>
            ) : null}
          </span>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() =>
                void navigate(
                  journee
                    ? `/sp/fiche-matinale/journee/${encodeURIComponent(journee.reference)}`
                    : "/sp/fiche-matinale",
                )
              }
              className="flex h-8 items-center gap-1.5 rounded-md border border-[#e2e8f0] bg-white px-3 text-[13px] text-[#0f172a] hover:border-[#94a3b8]"
            >
              Ouvrir la fiche matinale
              <ArrowRight size={14} />
            </button>
            <button
              type="button"
              onClick={() =>
                void navigate(
                  journee
                    ? `/sp/fiche-matinale/rapprochement-depenses/${encodeURIComponent(journee.reference)}`
                    : "/sp/fiche-matinale",
                )
              }
              className="flex h-8 items-center gap-1.5 rounded-md border border-[#e2e8f0] bg-white px-3 text-[13px] text-[#0f172a] hover:border-[#94a3b8]"
            >
              Rapprochement des dépenses
              <ArrowRight size={14} />
            </button>
          </div>
        </div>
        <div
          className="grid"
          style={{
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          }}
        >
          {resumeItems.map((r) => (
            <div
              key={r.l}
              className="flex flex-col border-r border-[#f1f5f9] last:border-r-0"
              style={{ gap: 4, padding: "16px 18px" }}
            >
              <span className="text-[11.5px] font-semibold uppercase tracking-[0.08em] text-[#64748b]">
                {r.l}
              </span>
              <span
                className="text-[14.5px] font-semibold"
                style={{ color: r.c }}
              >
                {chargement ? "…" : r.v}
              </span>
              <span className="text-[13px] text-[#64748b]">{r.s}</span>
            </div>
          ))}
        </div>
      </div>
    ) : null;

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-6">
      <div className="flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto">
      <SpPageHeader
        eyebrow={eyebrow}
        title="Tableau de bord"
        description="Position de trésorerie de la journée, alimentée par la Fiche Bleue, la Fiche d'exécution et les fiches de dépôt."
        actions={
          <>
            <button
              type="button"
              onClick={() => void charger(true)}
              disabled={rafraichissement || chargement}
              className="flex h-[38px] items-center gap-2 rounded-md border border-[#cbd5e1] bg-white px-3.5 text-sm font-medium text-[#0f172a] hover:border-[#94a3b8] hover:bg-[#f8fafc] disabled:opacity-60"
            >
              <RefreshCw
                size={16}
                className={rafraichissement ? "animate-spin" : undefined}
              />
              Actualiser
              <span className="text-xs text-[#64748b]">
                {heureRafraichissement}
              </span>
            </button>
            {journeeCloturee ? (
              <button
                type="button"
                onClick={() => setDialogReouverture(true)}
                disabled={chargement || reouvertureEnCours}
                className="flex h-[38px] items-center gap-2 rounded-md border bg-white px-4 text-sm font-semibold disabled:opacity-60"
                style={{
                  borderColor: theme.topColor,
                  color: theme.textColor,
                }}
              >
                {reouvertureEnCours ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <LockOpen size={16} />
                )}
                Réouvrir la journée
              </button>
            ) : journeeOuverte ? (
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
            ) : null}
          </>
        }
      />

      {/* KPIs */}
      <div
        className="shrink-0 overflow-hidden rounded-lg border border-[#e2e8f0] bg-white"
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))",
        }}
      >
        {kpis.map((k) => {
          const Icone = k.Icon;
          return (
            <div
              key={k.l}
              className="flex flex-col border-r border-[#e2e8f0] last:border-r-0"
              style={{
                gap: 4,
                padding: "14px 18px",
                background: k.hi ? theme.bgColor : "#fff",
                boxShadow: k.hi
                  ? `inset 0 3px 0 ${theme.topColor}`
                  : undefined,
              }}
            >
              <div className="text-[11.5px] font-semibold uppercase tracking-[0.08em] text-[#64748b]">
                {k.l}
              </div>
              <div className="flex flex-wrap items-baseline gap-1.5">
                <span
                  className="text-[22px] font-semibold tracking-[-0.01em] tabular-nums leading-tight"
                  style={{ color: chargement ? "#0f172a" : k.vc }}
                >
                  {chargement ? "—" : k.v}
                </span>
                <span className="text-xs font-semibold text-[#64748b]">
                  FCFA
                </span>
              </div>
              <div className="mt-auto flex items-center justify-between gap-3">
                <div className="min-w-0 text-[13px] text-[#475569]">{k.s}</div>
                <div
                  className="grid size-8 shrink-0 place-items-center rounded-md"
                  style={{
                    background: k.hi ? "#fff" : theme.iconBg,
                    color: k.ic,
                  }}
                  aria-hidden
                >
                  <Icone size={16} />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* État : pas de journée */}
      {!chargement && !journeeOuverte ? (
        <div
          className="flex flex-col items-start rounded-lg border border-[#e2e8f0] bg-white"
          style={{
            gap: 18,
            padding: 40,
            borderLeft: `4px solid ${theme.topColor}`,
          }}
        >
          <div
            className="grid size-11 place-items-center rounded-lg"
            style={{ background: theme.iconBg, color: theme.textColor }}
          >
            <Sunrise size={22} />
          </div>
          <div className="flex max-w-[620px] flex-col" style={{ gap: 6 }}>
            <div
              className="font-semibold text-[#0f172a]"
              style={{
                fontFamily: '"IBM Plex Serif", serif',
                fontSize: 20,
              }}
            >
              Aucune journée de trésorerie ouverte
            </div>
            <div
              className="text-[14.5px] text-[#475569]"
              style={{ lineHeight: 1.6 }}
            >
              Démarrez la journée pour suivre les recettes, les dépenses et le
              résumé de la journée. L&apos;ouverture regroupe la Fiche Bleue, la
              Fiche d&apos;exécution et les fiches de dépôt du Service
              Règlement.
            </div>
          </div>
          <button
            type="button"
            onClick={() => void demarrerJournee()}
            disabled={ouvertureEnCours}
            className="flex items-center gap-2.5 rounded-md border-0 px-5 text-[14.5px] font-semibold text-white disabled:opacity-60"
            style={{ height: 44, background: theme.ctaColor }}
          >
            {ouvertureEnCours ? (
              <Loader2 size={18} className="animate-spin" />
            ) : null}
            Démarrer la journée trésorerie du{" "}
            {formaterDateSeuleMatinale(new Date())}
            <ArrowRight size={18} />
          </button>
        </div>
      ) : null}

      {/* Journée ouverte — tableaux (zone scrollable) */}
      {chargement || journeeOuverte ? (
        <div
          className="grid min-h-0 flex-1"
          style={{
            gridTemplateColumns:
              "repeat(auto-fit, minmax(min(100%, 460px), 1fr))",
            gap: 20,
            alignItems: "stretch",
          }}
        >
          <TableauLignes
            titre="Recettes"
            source={`Source : ${sourceRecettes}`}
            icon={<ArrowUpRight size={18} />}
            iconColor="#047857"
            chargement={chargement}
            lignes={recettesLignes}
            total={data?.totaux.recettes ?? ind?.total_recettes ?? "0"}
            totalLabel="Total recettes"
            empty="Aucune recette pour cette journée."
          />
          <TableauLignes
            titre="Dépenses"
            source={`Source : ${sourceDepenses}`}
            icon={<ArrowDownRight size={18} />}
            iconColor="#b91c1c"
            chargement={chargement}
            lignes={depensesLignes}
            total={
              data?.totaux.depenses_realise ?? ind?.total_depenses ?? "0"
            }
            totalLabel="Total dépenses"
            empty="Aucune dépense pour cette journée."
          />
        </div>
      ) : null}
      </div>

      {/* Résumé fixé en bas du tableau de bord */}
      {resumeBloc}

      {/* Dialog clôture maquette */}
      <AlertDialog open={dialogCloture} onOpenChange={setDialogCloture}>
        <AlertDialogContent className="sm:max-w-[520px]">
          <AlertDialogHeader>
            <AlertDialogTitle
              style={{
                fontFamily: '"IBM Plex Serif", serif',
                fontSize: 21,
                fontWeight: 600,
              }}
            >
              Clôturer la journée ?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-sm leading-relaxed text-[#475569]">
              La journée {journee?.reference} sera archivée. Les montants
              réalisés de la Fiche d&apos;exécution alimenteront la fiche
              consolidée (semaine / mois / année). La Fiche Bleue et la Fiche
              d&apos;exécution liées seront également clôturées.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {journee && ind ? (
            <div className="flex flex-col overflow-hidden rounded-lg border border-[#e2e8f0] text-sm">
              <div className="flex justify-between border-b border-[#f1f5f9] px-3.5 py-2.5">
                <span className="text-[#475569]">Solde d&apos;ouverture</span>
                <span className="tabular-nums">
                  {formaterMontantFcfa(ind.solde_ouverture)}
                </span>
              </div>
              <div className="flex justify-between border-b border-[#f1f5f9] px-3.5 py-2.5">
                <span className="text-[#475569]">Recettes</span>
                <span className="tabular-nums">
                  + {formaterMontantFcfa(ind.total_recettes)}
                </span>
              </div>
              <div className="flex justify-between border-b border-[#f1f5f9] px-3.5 py-2.5">
                <span className="text-[#475569]">Dépenses</span>
                <span className="tabular-nums">
                  − {formaterMontantFcfa(ind.total_depenses)}
                </span>
              </div>
              <div
                className="flex justify-between px-3.5 py-3 font-semibold"
                style={{ background: theme.bgColor }}
              >
                <span>Solde de clôture</span>
                <span className="tabular-nums">
                  {formaterMontantFcfa(ind.solde_cloture)} FCFA
                </span>
              </div>
            </div>
          ) : null}
          <div className="flex items-center gap-2 text-[13px] text-[#b45309]">
            <AlertTriangle size={16} />
            Cette action n&apos;est pas réversible sans l&apos;intervention du
            chef de service.
          </div>
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
              {clotureEnCours ? (
                <Loader2 className="size-4 animate-spin" />
              ) : null}
              Clôturer la journée
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={dialogReouverture} onOpenChange={setDialogReouverture}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Réouvrir la journée ?</AlertDialogTitle>
            <AlertDialogDescription>
              La clôture de la journée {journee?.reference} sera annulée.
              {estChefService
                ? " En tant que chef de service, vous pouvez réouvrir toute journée clôturée."
                : " Seule la dernière journée peut être réouverte."}
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
              {reouvertureEnCours ? (
                <Loader2 className="size-4 animate-spin" />
              ) : null}
              Réouvrir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

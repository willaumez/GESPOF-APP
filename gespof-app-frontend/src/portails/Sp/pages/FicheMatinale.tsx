import { useEffect, useState } from "react";
import { useLocation, useSearchParams } from "react-router-dom";
import { ArrowRight, Loader2, Sunrise } from "lucide-react";
import { toast } from "sonner";
import { getPortalMenu } from "@/shared/config/menu";
import { formaterDateSeuleMatinale } from "@/shared/lib/format-date-heure";
import { JourneeTresorerieVue } from "@/portails/Sp/components/fiche-matinale/JourneeTresorerieVue";
import { SpPageHeader } from "@/portails/Sp/components/layout/SpPageHeader";
import {
  creerJourneeTresorerie,
  journeeTresorerieParDate,
} from "@/portails/Sp/api/journees-tresorerie";
import { useJourneeSelectionnee } from "@/portails/Sp/hooks/journee-selectionnee";
import type { JourneeTresorerie } from "@/portails/Sp/types/journee-tresorerie.interface";

const theme = getPortalMenu("sp").theme;

const ETAPES = [
  {
    n: "1",
    l: "Fiche Bleue",
    s: "Programmation du jour",
    st: "À composer",
    k: "neu" as const,
  },
  {
    n: "2",
    l: "Fiche d'exécution",
    s: "Fiche matinale",
    st: "En attente",
    k: "warn" as const,
  },
  {
    n: "3",
    l: "Fiche de dépôt",
    s: "Reçus du Service Règlement",
    st: "—",
    k: "info" as const,
  },
] as const;

const TAG = {
  neu: { bg: "#f1f5f9", fg: "#475569" },
  warn: { bg: "#fffbeb", fg: "#b45309" },
  info: { bg: "#eff6ff", fg: "#1d4ed8" },
} as const;

type EtatNavigationMatinale = {
  journeeValidee?: JourneeTresorerie;
};

/**
 * Accueil Fiche matinale — ouverture de journée / reprise (maquette Prototype v2).
 */
export default function FicheMatinale() {
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const {
    journee: journeeAvecExecution,
    chargement,
    appliquerJournee,
  } = useJourneeSelectionnee();
  const [maintenant, setMaintenant] = useState(() => new Date());
  const [dateResolue, setDateResolue] = useState<string | null>(null);
  const [ouvertureEnCours, setOuvertureEnCours] = useState(false);

  const dateCible = searchParams.get("date");
  const journeeValidee = (location.state as EtatNavigationMatinale | null)
    ?.journeeValidee;

  useEffect(() => {
    const id = window.setInterval(() => setMaintenant(new Date()), 30_000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    if (journeeValidee) appliquerJournee(journeeValidee);
  }, [journeeValidee, appliquerJournee]);

  useEffect(() => {
    if (!dateCible || journeeValidee) return;
    let annule = false;
    journeeTresorerieParDate(dateCible)
      .then(({ journee: cible }) => {
        if (annule) return;
        if (cible) {
          appliquerJournee(cible);
          return;
        }
        toast.info(
          "Aucune journée de trésorerie n'est ouverte pour la date de cette fiche.",
        );
      })
      .catch((e) => {
        if (annule) return;
        toast.error(
          e instanceof Error
            ? e.message
            : "Impossible de vérifier la journée de trésorerie.",
        );
      })
      .finally(() => {
        if (!annule) setDateResolue(dateCible);
      });
    return () => {
      annule = true;
    };
  }, [dateCible, journeeValidee, appliquerJournee]);

  const dateBouton = formaterDateSeuleMatinale(maintenant);
  const resolutionLien =
    dateCible != null && journeeValidee == null && dateResolue !== dateCible;

  async function ouvrirJournee() {
    setOuvertureEnCours(true);
    try {
      const { journee: creee } = await creerJourneeTresorerie();
      toast.success(`Journée ${creee.reference} ouverte.`);
      appliquerJournee(creee);
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

  if (chargement || resolutionLien) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center gap-2 text-[#64748b]">
        <Loader2 className="size-6 animate-spin" />
        <span className="text-[13px]">Vérification de la journée…</span>
      </div>
    );
  }

  if (journeeAvecExecution) {
    return (
      <JourneeTresorerieVue
        key={journeeAvecExecution.reference}
        journee={journeeAvecExecution}
        onJourneeChange={appliquerJournee}
        ongletInitial="fiche-execution"
      />
    );
  }

  return (
    <>
      <SpPageHeader
        eyebrow={`Service de Prévision · ${dateBouton}`}
        title="Fiche matinale"
        description="Programmation (Fiche Bleue), suivi matinal (Fiche d'exécution) et reçus du Service Règlement (Fiche de dépôt)."
      />

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
            Ouvrir la journée regroupe, pour la date du jour, la programmation
            (Fiche Bleue), le suivi matinal (Fiche d&apos;exécution) et les
            reçus du Service Règlement (Fiche de dépôt).
          </div>
        </div>
        <button
          type="button"
          onClick={() => void ouvrirJournee()}
          disabled={ouvertureEnCours}
          className="flex items-center gap-2.5 rounded-md border-0 px-5 text-[14.5px] font-semibold text-white disabled:opacity-60"
          style={{ height: 44, background: theme.ctaColor }}
        >
          {ouvertureEnCours ? (
            <Loader2 size={18} className="animate-spin" />
          ) : null}
          Démarrer la journée trésorerie du {dateBouton}
          <ArrowRight size={18} />
        </button>
      </div>

      <div
        className="grid"
        style={{
          gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
          gap: 12,
        }}
      >
        {ETAPES.map((s) => {
          const tag = TAG[s.k];
          return (
            <div
              key={s.n}
              className="flex items-center rounded-lg border border-[#e2e8f0] bg-[#fbfcfd]"
              style={{ gap: 14, padding: "16px 18px" }}
            >
              <span
                className="grid size-8 shrink-0 place-items-center rounded-md text-sm font-semibold"
                style={{ background: "#f1f5f9", color: "#475569" }}
              >
                {s.n}
              </span>
              <span className="flex min-w-0 flex-1 flex-col leading-snug">
                <span className="text-[15px] font-semibold text-[#0f172a]">
                  {s.l}
                </span>
                <span className="text-[12.5px] text-[#64748b]">{s.s}</span>
              </span>
              <span
                className="shrink-0 font-medium whitespace-nowrap"
                style={{
                  fontSize: 12,
                  padding: "2px 9px",
                  borderRadius: 4,
                  background: tag.bg,
                  color: tag.fg,
                }}
              >
                {s.st}
              </span>
            </div>
          );
        })}
      </div>
    </>
  );
}

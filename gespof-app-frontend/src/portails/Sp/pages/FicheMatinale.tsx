import { useEffect, useState } from "react";
import { useLocation, useSearchParams } from "react-router-dom";
import { CreditCard, FileText, Loader2, Sunrise } from "lucide-react";
import { toast } from "sonner";
import { getPortalMenu } from "@/shared/config/menu";
import { Button } from "@/shared/components/ui/button";
import { formaterDateSeuleMatinale } from "@/shared/lib/format-date-heure";
import { ResumeJourneeMatinale } from "@/portails/Sp/components/fiche-matinale/ResumeJourneeMatinale";
import {
  creerJourneeTresorerie,
  journeeTresorerieParDate,
} from "@/portails/Sp/api/journees-tresorerie";
import { useJourneeSelectionnee } from "@/portails/Sp/hooks/journee-selectionnee";
import type { JourneeTresorerie } from "@/portails/Sp/types/journee-tresorerie.interface";

const ETAPES = [
  {
    numero: 1,
    titre: "Fiche Bleue",
    sousTitre: "Programmation du jour",
    description:
      "Prévision de trésorerie du jour : composition des sections (Solde d'entrée, recettes, dépenses) et montants programmés pour la date du jour.",
    icone: FileText,
  },
  {
    numero: 2,
    titre: "Fiche d'exécution",
    sousTitre: "Fiche matinale",
    description:
      "Suivi de la réalisation au fil de la journée : mise à jour régulière des montants réalisés, soldes bancaires et écarts par rapport à la programmation.",
    icone: Sunrise,
  },
  {
    numero: 3,
    titre: "Fiche de dépôt",
    sousTitre: "Reçus du Service Règlement",
    description:
      "Pièces et mouvements issus du Service Règlement (SR), intégrés pour alimenter et rapprocher l'exécution de la journée de trésorerie.",
    icone: CreditCard,
  },
] as const;

type EtatNavigationMatinale = {
  journeeValidee?: JourneeTresorerie;
};

/**
 * Accueil Fiche matinale — journée choisie dans la TopBar (journée du jour par défaut) :
 * - pas de journée du jour → ouverture ;
 * - journée existante → Fiche d'exécution (et boutons vers les autres fiches) ;
 * - « Journée Trésorerie » ouvre le workflow à onglets.
 */
export default function FicheMatinale() {
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const theme = getPortalMenu("sp").theme;
  const {
    journee: journeeAvecExecution, chargement, appliquerJournee,
  } = useJourneeSelectionnee();
  const [maintenant, setMaintenant] = useState(() => new Date());
  /** Date `?date=` déjà résolue : résolution en cours tant qu'elle diffère de la date du lien. */
  const [dateResolue, setDateResolue] = useState<string | null>(null);
  const [ouvertureEnCours, setOuvertureEnCours] = useState(false);

  const dateCible = searchParams.get("date");
  const journeeValidee = (location.state as EtatNavigationMatinale | null)
    ?.journeeValidee;

  useEffect(() => {
    const id = window.setInterval(() => setMaintenant(new Date()), 30_000);
    return () => window.clearInterval(id);
  }, []);

  // Retour après « Valider » : la journée validée devient la journée affichée.
  useEffect(() => {
    if (journeeValidee) appliquerJournee(journeeValidee);
  }, [journeeValidee, appliquerJournee]);

  // Lien `?date=` (notification SR) : sélectionne la journée de cette date.
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
          e instanceof Error ? e.message : "Impossible de vérifier la journée de trésorerie.",
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
        e instanceof Error ? e.message : "Impossible d'ouvrir la journée de trésorerie.",
      );
    } finally {
      setOuvertureEnCours(false);
    }
  }

  if (chargement || resolutionLien) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center gap-2 text-muted-foreground">
        <Loader2 className="size-6 animate-spin" />
        <span className="text-[13px]">Vérification de la journée…</span>
      </div>
    );
  }

  if (journeeAvecExecution) {
    return (
      <ResumeJourneeMatinale
        key={journeeAvecExecution.reference}
        journee={journeeAvecExecution}
        onJourneeChange={appliquerJournee}
      />
    );
  }

  return (
    <div className="flex w-full min-h-[calc(100vh-11rem)] items-center justify-center">
      <div className="mx-auto flex w-full max-w-7xl flex-col items-center justify-center gap-8 px-1 py-4 sm:gap-10 sm:px-2 sm:py-6 lg:gap-12">
        <div className="flex w-full max-w-3xl flex-col items-center gap-5 text-center sm:gap-6">
          <div
            className="flex size-12 items-center justify-center rounded-2xl sm:size-14"
            style={{ background: theme.iconBg, color: theme.iconColor }}
          >
            <Sunrise className="size-6 sm:size-7" />
          </div>

          <div className="space-y-2 sm:space-y-3">
            <p
              className="text-[11px] font-semibold tracking-[0.12em] uppercase sm:text-[12px]"
              style={{ color: theme.iconColor }}
            >
              Journée de trésorerie
            </p>
            <p className="mx-auto max-w-lg text-[13px] leading-relaxed text-foreground/75 sm:text-[14.5px]">
              Ouvrir la journée regroupe, pour la date du jour, la programmation
              (Fiche Bleue), le suivi matinal (Fiche d&apos;exécution) et les reçus
              du Service Règlement (Fiche de dépôt).
            </p>
          </div>

          <Button
            type="button"
            size="lg"
            className="h-11 w-full max-w-md gap-2 px-4 text-[12px] font-semibold tracking-wide uppercase shadow-md transition-[transform,box-shadow] hover:-translate-y-0.5 hover:shadow-lg sm:h-12 sm:w-auto sm:px-8 sm:text-[13px]"
            style={{ background: theme.ctaColor, color: "#fff" }}
            disabled={ouvertureEnCours}
            onClick={() => void ouvrirJournee()}
          >
            {ouvertureEnCours && <Loader2 className="size-4 animate-spin" />}
            Ouvrir la journée trésorerie du {dateBouton}
          </Button>
        </div>

        <ol className="grid w-full grid-cols-1 gap-4 sm:gap-5 md:grid-cols-2 lg:grid-cols-3 lg:gap-6">
          {ETAPES.map((etape) => {
            const Icone = etape.icone;
            return (
              <li
                key={etape.numero}
                className="group relative flex min-h-0 flex-col gap-3 rounded-2xl border-2 bg-card p-4 text-left shadow-md transition-[transform,box-shadow] duration-300 hover:-translate-y-1 hover:shadow-xl sm:gap-4 sm:p-5 md:p-6 md:last:col-span-2 lg:last:col-span-1"
                style={{ borderColor: `${theme.topColor}33` }}
              >
                <div
                  className="absolute -top-2.5 -right-2.5 flex size-7 items-center justify-center rounded-full text-[11px] font-bold text-white shadow-sm sm:-top-3 sm:-right-3"
                  style={{ background: theme.ctaColor }}
                >
                  {etape.numero}
                </div>
                <div className="flex items-center gap-3">
                  <div
                    className="flex size-9 shrink-0 items-center justify-center rounded-xl sm:size-10"
                    style={{ background: theme.iconBg, color: theme.iconColor }}
                  >
                    <Icone className="size-4 sm:size-5" />
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-[14px] font-bold text-foreground sm:text-[15px]">
                      {etape.titre}
                    </p>
                    <p className="truncate text-[11.5px] font-medium text-muted-foreground sm:text-[12px]">
                      {etape.sousTitre}
                    </p>
                  </div>
                </div>
                <p
                  className="border-t pt-3 text-[12.5px] leading-relaxed text-foreground/75 sm:text-[13.5px]"
                  style={{ borderColor: `${theme.topColor}22` }}
                >
                  {etape.description}
                </p>
                <div className="mt-auto flex items-center gap-2 pt-1 text-[11px] text-muted-foreground">
                  <span className="h-1 w-full overflow-hidden rounded-full bg-muted">
                    <span
                      className="block h-full rounded-full transition-all duration-500 group-hover:w-full"
                      style={{
                        width: `${(etape.numero / ETAPES.length) * 100}%`,
                        background: theme.ctaColor,
                      }}
                    />
                  </span>
                  <span className="shrink-0 font-mono text-[10px]">
                    {etape.numero}/{ETAPES.length}
                  </span>
                </div>
              </li>
            );
          })}
        </ol>
      </div>
    </div>
  );
}

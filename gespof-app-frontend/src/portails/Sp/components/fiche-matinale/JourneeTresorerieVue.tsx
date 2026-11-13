import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Check, Download, Lock } from "lucide-react";
import { toast } from "sonner";
import { Tabs, TabsContent } from "@/shared/components/ui/tabs";
import { formaterDateSeuleMatinale } from "@/shared/lib/format-date-heure";
import { getPortalMenu } from "@/shared/config/menu";
import { detailFicheBleue } from "@/portails/Sp/api/fiches-bleues";
import { detailFicheExecution } from "@/portails/Sp/api/fiches-execution";
import { listerFichesDepotDeJournee } from "@/portails/Sp/api/fiches-depot";
import { PreviewFicheBleueDialog } from "@/portails/Sp/components/fiche-matinale/PreviewFicheBleueDialog";
import { TabFicheBleue } from "@/portails/Sp/components/fiche-matinale/TabFicheBleue";
import { TabFicheDepot } from "@/portails/Sp/components/fiche-matinale/TabFicheDepot";
import { TabFicheExecution } from "@/portails/Sp/components/fiche-matinale/TabFicheExecution";
import { SpPageHeader } from "@/portails/Sp/components/layout/SpPageHeader";
import type { FicheExecutionDetail } from "@/portails/Sp/types/fiche-execution.interface";
import type { JourneeTresorerie } from "@/portails/Sp/types/journee-tresorerie.interface";

const theme = getPortalMenu("sp").theme;

/** Ordre maquette : Bleue → Exécution → Dépôt (Recettes via bouton Oracle). */
const FICHIERS = [
  {
    id: "fiche-bleue",
    titre: "Fiche Bleue",
    sousTitre: "Programmation du jour",
  },
  {
    id: "fiche-execution",
    titre: "Fiche d'exécution",
    sousTitre: "Fiche matinale",
  },
  {
    id: "fiche-depot",
    titre: "Fiche de dépôt",
    sousTitre: "Reçus du Service Règlement",
  },
] as const;

type FichierId = (typeof FICHIERS)[number]["id"];

function estFichierId(valeur: string | null): valeur is FichierId {
  return FICHIERS.some((f) => f.id === valeur);
}

interface ProgrammationFicheBleue {
  soldeProgramme: string | null;
  totalRecettes: string | null;
  totalDepenses: string | null;
  dateLibelle: string;
  heureMaj: string | null;
  chargement: boolean;
}

const REF_JT_DATE = /^JT-(\d{2})-(\d{2})-(\d{4})-\d{3}$/;

const TAG = {
  ok: { bg: "#ecfdf5", fg: "#047857" },
  warn: { bg: "#fffbeb", fg: "#b45309" },
  info: { bg: "#eff6ff", fg: "#1d4ed8" },
  neu: { bg: "#f1f5f9", fg: "#475569" },
} as const;

/** Date métier de la journée : portée par la référence (JT-JJ-MM-AAAA-NNN), sinon la création. */
function dateMetierJournee(journee: JourneeTresorerie): Date {
  const m = REF_JT_DATE.exec(journee.reference);
  if (m) return new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]));
  return new Date(journee.date_creation);
}

function formaterHeureCourte(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (!Number.isNaN(d.getTime())) {
    return d.toLocaleTimeString("fr-FR", {
      hour: "2-digit",
      minute: "2-digit",
    });
  }
  // Formats déjà localisés (ex. « 30/10/2026 10:02 »).
  const m = /(\d{1,2}:\d{2})/.exec(iso);
  return m?.[1] ?? null;
}

function aFicheBleue(journee: JourneeTresorerie): boolean {
  return journee.fiche_bleue_id != null;
}

function peutOuvrirOnglet(id: FichierId, journee: JourneeTresorerie): boolean {
  if (id === "fiche-bleue") return true;
  return aFicheBleue(journee);
}

function ongletAutorise(
  demande: string | null,
  journee: JourneeTresorerie,
): FichierId {
  if (demande === "fiche-depot") return "fiche-depot";
  if (!estFichierId(demande) || !peutOuvrirOnglet(demande, journee)) {
    return FICHIERS[0].id;
  }
  return demande;
}

function etapesValides(
  journee: JourneeTresorerie,
  nombreDepots: number,
): Set<FichierId> {
  const valides = new Set<FichierId>();
  if (!aFicheBleue(journee)) return valides;
  valides.add("fiche-bleue");
  if (nombreDepots > 0) valides.add("fiche-depot");
  if (journee.fiche_execution_id != null) valides.add("fiche-execution");
  return valides;
}

interface JourneeTresorerieVueProps {
  journee: JourneeTresorerie;
  onJourneeChange?: (journee: JourneeTresorerie) => void;
  /** Onglet par défaut si l'URL ne précise pas `?onglet=`. */
  ongletInitial?: FichierId;
}

/**
 * Vue « Journée de trésorerie » (maquette Prototype v2) :
 * en-tête SpPageHeader + stepper fichiers + panneau de l'étape active.
 */
export function JourneeTresorerieVue({
  journee: journeeInitiale,
  onJourneeChange,
  ongletInitial,
}: JourneeTresorerieVueProps) {
  const [searchParams] = useSearchParams();
  const [journee, setJournee] = useState(journeeInitiale);
  const ongletUrl = searchParams.get("onglet");
  const creerFicheBleueUrl = searchParams.get("creer") === "1";
  const [ongletActif, setOngletActif] = useState<string>(() =>
    ongletAutorise(ongletUrl ?? ongletInitial ?? null, journeeInitiale),
  );
  const [apercuBleueId, setApercuBleueId] = useState<number | null>(null);
  const [nombreDepots, setNombreDepots] = useState(0);
  const [heureDernierDepot, setHeureDernierDepot] = useState<string | null>(null);
  const [heureFicheBleue, setHeureFicheBleue] = useState<string | null>(null);
  const [heureFicheExecution, setHeureFicheExecution] = useState<string | null>(
    null,
  );
  const [valides, setValides] = useState<ReadonlySet<FichierId>>(() =>
    etapesValides(journeeInitiale, 0),
  );
  const [ouvrirSelectionFicheBleue, setOuvrirSelectionFicheBleue] = useState(false);
  const [ouvrirCreationFicheBleue, setOuvrirCreationFicheBleue] =
    useState(creerFicheBleueUrl && journeeInitiale.etat !== "cloture");
  const [ouvrirEditionFicheBleue, setOuvrirEditionFicheBleue] = useState(false);
  const [pleinEcranFicheBleue, setPleinEcranFicheBleue] = useState(false);
  const [actionsEditionFicheBleue, setActionsEditionFicheBleue] =
    useState<HTMLDivElement | null>(null);
  const [programmationFicheBleue, setProgrammationFicheBleue] =
    useState<ProgrammationFicheBleue | null>(null);
  const [ficheExecution, setFicheExecution] =
    useState<FicheExecutionDetail | null>(null);
  /** Journée clôturée (non réouverte) : toutes les modifications sont désactivées. */
  const cloturee = journee.etat === "cloture";

  useEffect(() => {
    setJournee(journeeInitiale);
  }, [journeeInitiale]);

  useEffect(() => {
    setValides(etapesValides(journee, nombreDepots));
  }, [journee, nombreDepots]);

  useEffect(() => {
    setOngletActif((actuel) => {
      const demande = estFichierId(ongletUrl) ? ongletUrl : actuel;
      return ongletAutorise(demande, journee);
    });
  }, [ongletUrl, journee.fiche_bleue_id]);

  useEffect(() => {
    if (!creerFicheBleueUrl || cloturee) return;
    setOuvrirSelectionFicheBleue(false);
    setOuvrirEditionFicheBleue(false);
    setOuvrirCreationFicheBleue(true);
    setOngletActif("fiche-bleue");
  }, [creerFicheBleueUrl, cloturee]);

  function allerCreerFicheBleue() {
    if (cloturee) return;
    setOuvrirSelectionFicheBleue(false);
    setOuvrirEditionFicheBleue(false);
    setOuvrirCreationFicheBleue(true);
    setOngletActif("fiche-bleue");
  }

  useEffect(() => {
    let annule = false;
    void listerFichesDepotDeJournee(journee.reference)
      .then((page) => {
        if (annule) return;
        const fiches = page.fiches ?? [];
        setNombreDepots(fiches.length);
        const derniere = fiches.reduce<{ iso: string | null }>(
          (acc, f) => {
            const iso = f.date_creation;
            if (!iso) return acc;
            if (!acc.iso || new Date(iso) > new Date(acc.iso)) {
              return { iso };
            }
            return acc;
          },
          { iso: null },
        );
        setHeureDernierDepot(formaterHeureCourte(derniere.iso));
      })
      .catch(() => {
        if (!annule) {
          setNombreDepots(0);
          setHeureDernierDepot(null);
        }
      });
    return () => {
      annule = true;
    };
  }, [journee.reference, journee.fiche_bleue_id]);

  // Heures du stepper : chargées hors onglet (sinon absentes tant que l'onglet n'a pas monté).
  useEffect(() => {
    if (journee.fiche_bleue_id == null) {
      setHeureFicheBleue(null);
      return;
    }
    let annule = false;
    void detailFicheBleue(journee.fiche_bleue_id)
      .then(({ fiche }) => {
        if (!annule) {
          setHeureFicheBleue(
            formaterHeureCourte(fiche.date_modification ?? fiche.date_creation),
          );
        }
      })
      .catch(() => {
        if (!annule) setHeureFicheBleue(null);
      });
    return () => {
      annule = true;
    };
  }, [journee.fiche_bleue_id]);

  useEffect(() => {
    if (journee.fiche_execution_id == null) {
      setHeureFicheExecution(null);
      return;
    }
    let annule = false;
    void detailFicheExecution(journee.fiche_execution_id)
      .then(({ fiche }) => {
        if (!annule) {
          setHeureFicheExecution(
            formaterHeureCourte(
              fiche.date_dernier_mise_jour ?? fiche.date_creation,
            ),
          );
        }
      })
      .catch(() => {
        if (!annule) setHeureFicheExecution(null);
      });
    return () => {
      annule = true;
    };
  }, [journee.fiche_execution_id]);

  const onFicheExecutionChange = useCallback((fiche: FicheExecutionDetail | null) => {
    setFicheExecution(fiche);
    if (fiche) {
      setHeureFicheExecution(
        formaterHeureCourte(
          fiche.date_dernier_mise_jour ?? fiche.date_creation,
        ),
      );
    }
  }, []);

  const majJournee = useCallback((maj: JourneeTresorerie) => {
    setJournee(maj);
    onJourneeChange?.(maj);
  }, [onJourneeChange]);

  function allerOnglet(id: FichierId) {
    if (!peutOuvrirOnglet(id, journee)) {
      toast.error("Créez d'abord la Fiche Bleue avant d'ouvrir cet onglet.");
      return;
    }
    setOngletActif(id);
  }

  function avecHeure(label: string, heure: string | null | undefined): string {
    return heure ? `${label} ${heure}` : label;
  }

  function statutEtape(id: FichierId): { label: string; tag: keyof typeof TAG } {
    const verrouille = !peutOuvrirOnglet(id, journee);
    if (verrouille) return { label: "Verrouillé", tag: "neu" };
    if (id === "fiche-bleue") {
      if (valides.has(id)) {
        return {
          label: avecHeure(
            "Validée",
            programmationFicheBleue?.heureMaj ?? heureFicheBleue,
          ),
          tag: "ok",
        };
      }
      return { label: "À composer", tag: "neu" };
    }
    if (id === "fiche-execution") {
      const heureFe =
        formaterHeureCourte(
          ficheExecution?.date_dernier_mise_jour
            ?? ficheExecution?.date_creation
            ?? null,
        ) ?? heureFicheExecution;
      if (cloturee) {
        return { label: avecHeure("Clôturée", heureFe), tag: "neu" };
      }
      if (valides.has(id) || aFicheBleue(journee)) {
        return { label: avecHeure("En cours", heureFe), tag: "warn" };
      }
      return { label: "En attente", tag: "warn" };
    }
    if (id === "fiche-depot") {
      if (nombreDepots > 0) {
        return {
          label: avecHeure(
            `${nombreDepots} reçue${nombreDepots > 1 ? "s" : ""}`,
            heureDernierDepot,
          ),
          tag: "info",
        };
      }
      return { label: "—", tag: "info" };
    }
    return { label: "—", tag: "neu" };
  }

  function enregistrerFiche() {
    if (!ficheExecution) {
      toast.error("La Fiche d'exécution n'est pas encore disponible.");
      setOngletActif("fiche-execution");
      return;
    }
    toast.success("Fiche d'exécution enregistrée.");
  }

  const dateMetier = dateMetierJournee(journee);
  const heureOuverture = formaterHeureCourte(journee.date_creation);
  const eyebrow = cloturee
    ? `${journee.reference} · Clôturée`
    : heureOuverture
      ? `${journee.reference} · Ouverte à ${heureOuverture}`
      : `${journee.reference} · ${journee.etat_libelle}`;

  return (
    <div className="flex w-full flex-col gap-6">
      <SpPageHeader
        eyebrow={eyebrow}
        title={`Journée de trésorerie du ${formaterDateSeuleMatinale(dateMetier)}`}
        description="Programmation (Fiche Bleue), suivi matinal (Fiche d'exécution) et reçus du Service Règlement (Fiche de dépôt)."
        actions={
          <>
            <button
              type="button"
              onClick={() => {
                if (journee.fiche_bleue_id == null) {
                  toast.info("Aucune Fiche Bleue n'est liée à cette journée.");
                  return;
                }
                setApercuBleueId(journee.fiche_bleue_id);
              }}
              className="flex h-[38px] items-center gap-2 rounded-md border border-[#cbd5e1] bg-white px-3.5 text-sm font-medium text-[#0f172a] hover:border-[#94a3b8] hover:bg-[#f8fafc]"
            >
              <Download size={16} />
              Aperçu Excel
            </button>
            <button
              type="button"
              disabled={cloturee}
              onClick={enregistrerFiche}
              className="flex h-[38px] items-center gap-2 rounded-md border-0 px-4 text-sm font-semibold text-white disabled:opacity-60"
              style={{ background: theme.ctaColor }}
            >
              <Check size={16} />
              Enregistrer la fiche
            </button>
          </>
        }
      />

      <div
        className="grid w-full"
        style={{
          gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
          gap: 12,
        }}
        role="list"
        aria-label="Étapes de la fiche matinale"
      >
        {FICHIERS.map((fichier, index) => {
          const estActif = fichier.id === ongletActif;
          const verrouille = !peutOuvrirOnglet(fichier.id, journee);
          const st = statutEtape(fichier.id);
          const tag = TAG[st.tag];
          return (
            <button
              key={fichier.id}
              type="button"
              role="listitem"
              aria-current={estActif ? "step" : undefined}
              aria-disabled={verrouille || undefined}
              title={verrouille ? "Créez d'abord la Fiche Bleue" : undefined}
              onClick={() => allerOnglet(fichier.id)}
              className="flex w-full items-center rounded-lg border text-left"
              style={{
                gap: 14,
                padding: "16px 18px",
                background: estActif ? "#fff" : "#fbfcfd",
                borderColor: estActif ? theme.topColor : "#e2e8f0",
                boxShadow: `inset 0 3px 0 ${estActif ? theme.topColor : "transparent"}`,
                cursor: verrouille ? "not-allowed" : "pointer",
                opacity: verrouille ? 0.7 : 1,
              }}
            >
              <span
                className="grid size-8 shrink-0 place-items-center rounded-md text-sm font-semibold"
                style={{
                  background: estActif ? theme.topColor : "#f1f5f9",
                  color: estActif ? "#fff" : "#475569",
                }}
              >
                {verrouille ? <Lock className="size-3.5" /> : index + 1}
              </span>
              <span className="flex min-w-0 flex-1 flex-col" style={{ lineHeight: 1.3 }}>
                <span className="text-[15px] font-semibold text-[#0f172a]">
                  {fichier.titre}
                </span>
                <span className="text-[12.5px] text-[#64748b]">
                  {fichier.sousTitre}
                </span>
              </span>
              <span
                className="shrink-0 whitespace-nowrap"
                style={{
                  fontSize: 12,
                  fontWeight: 500,
                  padding: "2px 9px",
                  borderRadius: 4,
                  background: tag.bg,
                  color: tag.fg,
                }}
              >
                {st.label}
              </span>
            </button>
          );
        })}
      </div>

      <Tabs value={ongletActif} className="flex w-full flex-col">
        <TabsContent value="fiche-bleue" className="mt-0 outline-none">
          <div className="overflow-hidden rounded-lg border border-[#e2e8f0] bg-white">
            <TabFicheBleue
              journee={journee}
              onJourneeChange={majJournee}
              onProgrammationChange={setProgrammationFicheBleue}
              ouvrirSelection={ouvrirSelectionFicheBleue}
              onFermerSelection={() => setOuvrirSelectionFicheBleue(false)}
              ouvrirCreation={ouvrirCreationFicheBleue}
              onFermerCreation={() => setOuvrirCreationFicheBleue(false)}
              ouvrirEdition={ouvrirEditionFicheBleue}
              onFermerEdition={() => setOuvrirEditionFicheBleue(false)}
              conteneurActionsEdition={actionsEditionFicheBleue}
              pleinEcran={pleinEcranFicheBleue}
              onPleinEcranChange={setPleinEcranFicheBleue}
              actif={ongletActif === "fiche-bleue"}
            />
          </div>
        </TabsContent>

        <TabsContent value="fiche-execution" className="mt-0 outline-none">
          <TabFicheExecution
            journee={journee}
            onJourneeChange={majJournee}
            onFicheChange={onFicheExecutionChange}
            onCreerFicheBleue={allerCreerFicheBleue}
            actif={ongletActif === "fiche-execution"}
          />
        </TabsContent>

        <TabsContent value="fiche-depot" className="mt-0 outline-none">
          <TabFicheDepot
            journee={journee}
            actif={ongletActif === "fiche-depot"}
            onNombreFichesChange={setNombreDepots}
          />
        </TabsContent>
      </Tabs>

      <PreviewFicheBleueDialog
        ficheId={apercuBleueId}
        onClose={() => setApercuBleueId(null)}
      />
    </div>
  );
}

import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, FileWarning, Loader2, RefreshCw, ShieldAlert, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/shared/lib/utils";
import { messageDonneesOuDefaut } from "@/shared/lib/message-utilisateur";
import { formatMontant } from "@/shared/lib/format";
import { Badge } from "@/shared/components/ui/badge";
import { Button } from "@/shared/components/ui/button";
import {
  ResizableHandle, ResizablePanel, ResizablePanelGroup,
} from "@/shared/components/ui/resizable";
import { useIsMobile } from "@/shared/hooks/use-mobile";
import {
  Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle,
} from "@/shared/components/ui/empty";
import {
  annulerRapprochement,
  depensesJour,
  detailJourneeTresorerie,
  rapprocherElements,
  recettesJourValidees,
  validerDepensesJour,
} from "@/portails/Sp/api/journees-tresorerie";
import { trouverFicheExecutionJournee } from "@/portails/Sp/api/fiches-execution";
import { ColonneElementsJour } from "@/portails/Sp/components/rapprochement/ColonneElementsJour";
import {
  BoutonPleinEcran, OverlayPleinEcran,
} from "@/portails/Sp/components/plein-ecran/PleinEcran";
import {
  ColonneRubriquesFiche,
  type ResumeRapprochementSection,
} from "@/portails/Sp/components/rapprochement/ColonneRubriquesFiche";
import {
  LIBELLES_FAMILLE,
  LIBELLES_TYPE,
  depuisCentimes,
  depuisDepense,
  depuisRecette,
  formaterDateHeure,
  totalCentimes,
  type ElementRapprochable,
} from "@/portails/Sp/components/rapprochement/rapprochement";
import { useJourneeSelectionnee } from "@/portails/Sp/hooks/journee-selectionnee";
import type { FicheExecutionDetail, SectionFicheExecution } from "@/portails/Sp/types/fiche-execution.interface";
import type {
  DepensesJourValidees,
  EtatDepensesJour,
  JourneeTresorerie,
  RecettesJourValidees,
  TypeRapprochement,
} from "@/portails/Sp/types/journee-tresorerie.interface";

const REF_JT = /^JT-\d{2}-\d{2}-\d{4}-\d{3}$/;

const CATEGORIES_DEPENSES = Object.entries(LIBELLES_FAMILLE).map(([value, label]) => ({ value, label }));

type ListeValidee = RecettesJourValidees | DepensesJourValidees;

function montantFcfa(centimes: number): string {
  return `${formatMontant(depuisCentimes(centimes))} FCFA`;
}

function elementsDe(type: TypeRapprochement, liste: ListeValidee | null): ElementRapprochable[] {
  if (!liste) return [];
  return type === "recette"
    ? (liste as RecettesJourValidees).recettes.map(depuisRecette)
    : (liste as DepensesJourValidees).depenses.map(depuisDepense);
}

/**
 * Pages `/sp/fiche-matinale/rapprochement-recettes/:reference` et
 * `/sp/fiche-matinale/rapprochement-depenses/:reference` : rapprochent la liste
 * validée de la journée (gauche) des rubriques de la fiche d'exécution (droite),
 * par glisser-déposer ou au clic. Les rapprochements sont enregistrés côté serveur.
 */
export default function Rapprochement({ type }: { type: TypeRapprochement }) {
  const navigate = useNavigate();
  const { reference } = useParams<{ reference: string }>();
  const { appliquerJournee } = useJourneeSelectionnee();
  const estMobile = useIsMobile();
  const libelles = LIBELLES_TYPE[type];

  const [journee, setJournee] = useState<JourneeTresorerie | null>(null);
  const [fiche, setFiche] = useState<FicheExecutionDetail | null>(null);
  const [liste, setListe] = useState<ListeValidee | null>(null);
  const [etatDepenses, setEtatDepenses] = useState<EtatDepensesJour | null>(null);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState<string | null>(null);
  const [selection, setSelection] = useState<Map<string, ElementRapprochable>>(new Map());
  const [glissees, setGlissees] = useState<ElementRapprochable[] | null>(null);
  const [sectionEnCours, setSectionEnCours] = useState<number | null>(null);
  const [sectionRecente, setSectionRecente] = useState<number | null>(null);
  const [integration, setIntegration] = useState(false);
  const [pleinEcran, setPleinEcran] = useState(false);

  const referenceValide = reference != null && REF_JT.test(reference);

  useEffect(() => {
    if (!reference || !referenceValide) return;
    let annule = false;
    void (async () => {
      try {
        const [{ journee: j }, { fiche: f }, l] = await Promise.all([
          detailJourneeTresorerie(reference),
          trouverFicheExecutionJournee(reference),
          type === "recette"
            ? recettesJourValidees(reference).then((r) => ({ liste: r.recettes_jour, etat: null }))
            : depensesJour(reference).then((r) => ({ liste: r.depenses_jour, etat: r })),
        ]);
        if (annule) return;
        setJournee(j);
        appliquerJournee(j);
        setFiche(f);
        setListe(l.liste);
        setEtatDepenses(l.etat);
        if (!f) setErreur("Aucune Fiche d'exécution n'est liée à cette journée.");
        else if (!l.liste) {
          setErreur(
            type === "recette"
              ? "Aucune liste de recettes n'est validée pour cette journée. Validez-la depuis « Recettes du jour »."
              : "Aucune liste de dépenses n'est validée pour cette journée. Validez-la depuis « Fiche de dépôt ».",
          );
        }
      } catch (e) {
        if (annule) return;
        setErreur(messageDonneesOuDefaut(
          e instanceof Error ? e.message : null,
          "Impossible de charger la journée de trésorerie.",
        ));
      } finally {
        if (!annule) setChargement(false);
      }
    })();
    return () => {
      annule = true;
    };
  }, [reference, referenceValide, appliquerJournee, type]);

  useEffect(() => {
    if (sectionRecente == null) return;
    const t = window.setTimeout(() => setSectionRecente(null), 1200);
    return () => window.clearTimeout(t);
  }, [sectionRecente]);

  const elements = useMemo(() => elementsDe(type, liste), [type, liste]);
  const rapprochees = elements.filter((e) => e.rapprochement != null);

  const rapprochementsParSection = useMemo(() => {
    const index = new Map<number, ResumeRapprochementSection>();
    for (const e of elements) {
      if (!e.rapprochement) continue;
      const cumul = index.get(e.rapprochement.section_id) ?? { nombre: 0, centimes: 0 };
      index.set(e.rapprochement.section_id, {
        nombre: cumul.nombre + 1,
        centimes: cumul.centimes + totalCentimes([e]),
      });
    }
    return index;
  }, [elements]);

  const cloturee = journee?.etat === "cloture";
  const occupe = sectionEnCours != null;

  const rafraichirJournee = useCallback(() => {
    if (!reference) return;
    void detailJourneeTresorerie(reference).then(({ journee: j }) => {
      setJournee(j);
      appliquerJournee(j);
    });
  }, [reference, appliquerJournee]);

  async function annuler(groupe: string, sectionId: number, sectionNom: string) {
    if (!reference || occupe) return;
    setSectionEnCours(sectionId);
    try {
      const res = await annulerRapprochement<ListeValidee>(reference, type, groupe);
      setListe(res.liste);
      setFiche(res.fiche);
      setSectionRecente(sectionId);
      rafraichirJournee();
      toast.info(`Rapprochement annulé sur « ${sectionNom} ».`);
    } catch (e) {
      toast.error(messageDonneesOuDefaut(
        e instanceof Error ? e.message : null,
        "Impossible d'annuler le rapprochement.",
      ));
    } finally {
      setSectionEnCours(null);
    }
  }

  async function affecter(section: SectionFicheExecution, aAffecter: ElementRapprochable[]) {
    setGlissees(null);
    if (!reference || cloturee || occupe) return;
    const libres = aAffecter.filter((e) => e.rapprochement == null);
    if (libres.length === 0) {
      toast.info(`Ces ${libelles.pluriel} sont déjà rapprochées.`);
      return;
    }
    setSectionEnCours(section.id);
    try {
      const res = await rapprocherElements<ListeValidee>(
        reference,
        type,
        libres.map((e) => e.cle),
        section.id,
      );
      setListe(res.liste);
      setFiche(res.fiche);
      setSectionRecente(section.id);
      rafraichirJournee();
      setSelection((sel) => {
        const suivante = new Map(sel);
        for (const e of libres) suivante.delete(e.cle);
        return suivante;
      });
      const groupe = elementsDe(type, res.liste)
        .find((e) => e.cle === libres[0].cle)?.rapprochement?.groupe;
      toast.success(
        `${libres.length} ${libelles.singulier}${libres.length > 1 ? "s" : ""} · +${montantFcfa(totalCentimes(libres))} sur « ${section.nom} »`,
        groupe
          ? { action: { label: "Annuler", onClick: () => void annuler(groupe, section.id, section.nom) } }
          : undefined,
      );
    } catch (e) {
      toast.error(messageDonneesOuDefaut(
        e instanceof Error ? e.message : null,
        "Impossible d'enregistrer le rapprochement.",
      ));
    } finally {
      setSectionEnCours(null);
    }
  }

  async function integrerNouvellesFiches() {
    if (!reference || integration) return;
    setIntegration(true);
    try {
      const { nouvelles } = await validerDepensesJour(reference);
      const etat = await depensesJour(reference);
      setListe(etat.depenses_jour);
      setEtatDepenses(etat);
      toast.success(
        nouvelles > 0
          ? `${nouvelles} nouvelle${nouvelles > 1 ? "s" : ""} dépense${nouvelles > 1 ? "s" : ""} intégrée${nouvelles > 1 ? "s" : ""} (sans doublon).`
          : "Aucune nouvelle dépense : la fiche reprenait les éléments déjà validés.",
      );
    } catch (e) {
      toast.error(messageDonneesOuDefaut(
        e instanceof Error ? e.message : null,
        "Impossible d'intégrer les nouvelles fiches.",
      ));
    } finally {
      setIntegration(false);
    }
  }

  if (!referenceValide) {
    return renduIndisponible("Référence de journée invalide.");
  }

  if (chargement) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-muted-foreground">
        <Loader2 className="size-6 animate-spin" />
      </div>
    );
  }

  if (erreur || !journee || !fiche || !liste) {
    return renduIndisponible(erreur ?? "La fiche d'exécution n'a pas pu être chargée.", journee != null);
  }

  function renduIndisponible(texte: string, journeeChargee = false) {
    return (
      <Empty>
        <EmptyHeader>
          <EmptyMedia variant="icon">
            {journeeChargee ? <FileWarning /> : <ShieldAlert />}
          </EmptyMedia>
          <EmptyTitle>Rapprochement indisponible</EmptyTitle>
          <EmptyDescription>{texte}</EmptyDescription>
        </EmptyHeader>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => void navigate("/sp/fiche-matinale")}
        >
          Retour à la fiche matinale
        </Button>
      </Empty>
    );
  }

  const description = type === "recette" ? (
    <p>
      Liste du <span className="font-medium text-foreground">{(liste as RecettesJourValidees).date_ouverture}</span>
      {" "}validée le {formaterDateHeure(liste.validee_le)}
      {liste.validee_par ? ` par ${liste.validee_par}` : ""}.
    </p>
  ) : (
    <p>
      {(liste as DepensesJourValidees).fiches.length} fiche{(liste as DepensesJourValidees).fiches.length > 1 ? "s" : ""} de dépôt
      {" "}fusionnée{(liste as DepensesJourValidees).fiches.length > 1 ? "s" : ""} sans doublon · validée le{" "}
      {formaterDateHeure(liste.validee_le)}
      {liste.validee_par ? ` par ${liste.validee_par}` : ""}.
    </p>
  );

  const colonneJour = (
    <ColonneElementsJour
      type={type}
      description={description}
      elements={elements}
      categories={type === "depense" ? CATEGORIES_DEPENSES : undefined}
      selection={selection}
      onSelectionChange={setSelection}
      onAnnulerRapprochement={(e) => {
        if (e.rapprochement) {
          void annuler(e.rapprochement.groupe, e.rapprochement.section_id, e.rapprochement.section_nom);
        }
      }}
      onGlisserDebut={setGlissees}
      onGlisserFin={() => setGlissees(null)}
      desactive={cloturee || occupe}
    />
  );
  const colonneFiche = (
    <ColonneRubriquesFiche
      type={type}
      fiche={fiche}
      glissees={glissees}
      selection={[...selection.values()]}
      rapprochementsParSection={rapprochementsParSection}
      onAffecter={(section, aAffecter) => void affecter(section, aAffecter)}
      sectionEnCours={sectionEnCours}
      sectionRecente={sectionRecente}
      desactive={cloturee}
    />
  );

  const fichesNonIntegrees = etatDepenses?.fiches_non_integrees ?? [];

  const resume = rapprochees.length > 0 ? (
    <>
      <span className="font-semibold text-foreground">
        {rapprochees.length} / {elements.length} {libelles.singulier}{rapprochees.length > 1 ? "s" : ""} rapprochée{rapprochees.length > 1 ? "s" : ""}
      </span>
      {" · "}
      <span className="tabular-nums">{montantFcfa(totalCentimes(rapprochees))}</span>
    </>
  ) : (
    `Glissez une ${libelles.singulier} (ou une sélection) sur une rubrique : son montant s'ajoute au réalisé.`
  );

  // Rendu une seule fois : dans la page, ou dans l'overlay plein écran.
  const deuxColonnes = estMobile ? (
    <div className={cn("flex flex-col gap-3", pleinEcran && "h-full overflow-y-auto")}>
      <div className="h-[34rem] min-h-0 shrink-0">{colonneJour}</div>
      <div className="h-[34rem] min-h-0 shrink-0">{colonneFiche}</div>
    </div>
  ) : (
    <ResizablePanelGroup
      id={`rapprochement-${type}`}
      orientation="horizontal"
      className="min-h-[22rem] flex-1"
    >
      <ResizablePanel id={`rapprochement-${type}-jour`} defaultSize="45%" minSize="25%" className="h-full min-w-0 pr-1.5">
        {colonneJour}
      </ResizablePanel>
      <ResizableHandle withHandle className="bg-border" />
      <ResizablePanel id={`rapprochement-${type}-fiche`} defaultSize="55%" minSize="30%" className="h-full min-w-0 pl-1.5">
        {colonneFiche}
      </ResizablePanel>
    </ResizablePanelGroup>
  );

  return (
    <div className="flex flex-col gap-3 md:min-h-0 md:flex-1">
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={() => void navigate("/sp/fiche-matinale")}
          >
            <ArrowLeft className="size-3.5" />
            Retour
          </Button>
          <span className="truncate text-[13px] font-semibold tabular-nums">{journee.reference}</span>
          {cloturee ? (
            <Badge className="border-transparent bg-warning/10 text-warning">Journée clôturée</Badge>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[12px] text-muted-foreground">
          <span className="flex items-center gap-3" aria-label="Légende">
            <span className="flex items-center gap-1.5">
              <span className="size-3 rounded-sm border bg-background" />
              À rapprocher
            </span>
            <span className="flex items-center gap-1.5">
              <span className="size-3 rounded-sm border-l-4 border-l-emerald-500 bg-emerald-100" />
              Rapprochée
            </span>
          </span>
          <span>{resume}</span>
          <BoutonPleinEcran
            actif={pleinEcran}
            onToggle={() => setPleinEcran((v) => !v)}
            libelleEnter={`Afficher le rapprochement des ${libelles.pluriel} en plein écran`}
          />
        </div>
      </div>

      {type === "depense" && fichesNonIntegrees.length > 0 ? (
        <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 rounded-xl border border-amber-300 bg-amber-50 px-4 py-2.5 text-[12.5px] text-amber-950">
          <p className="flex min-w-0 items-center gap-2">
            <Sparkles className="size-4 shrink-0 text-amber-600" />
            <span>
              Nouvelle fiche de dépôt reçue ({fichesNonIntegrees.join(", ")}) :{" "}
              <span className="font-semibold">
                {etatDepenses?.nouvelles ?? 0} nouvelle{(etatDepenses?.nouvelles ?? 0) > 1 ? "s" : ""} dépense{(etatDepenses?.nouvelles ?? 0) > 1 ? "s" : ""}
              </span>
              . Les éléments déjà présents ne seront pas dupliqués.
            </span>
          </p>
          {!cloturee ? (
            <Button
              type="button"
              size="sm"
              className="h-8 shrink-0 gap-1.5 bg-amber-600 text-white hover:bg-amber-700"
              disabled={integration}
              onClick={() => void integrerNouvellesFiches()}
            >
              {integration ? <Loader2 className="size-3.5 animate-spin" /> : <RefreshCw className="size-3.5" />}
              Intégrer
            </Button>
          ) : null}
        </div>
      ) : null}

      {pleinEcran ? (
        <div className="flex min-h-[120px] flex-1 items-center justify-center rounded-xl border border-dashed text-[13px] text-muted-foreground">
          Rapprochement affiché en plein écran
        </div>
      ) : (
        deuxColonnes
      )}

      <OverlayPleinEcran
        ouvert={pleinEcran}
        titre={`Rapprochement des ${libelles.pluriel}`}
        sousTitre={journee.reference}
        onClose={() => setPleinEcran(false)}
        actions={<span className="hidden text-[12px] text-muted-foreground sm:inline">{resume}</span>}
        ariaLabel={`Rapprochement des ${libelles.pluriel} en plein écran`}
      >
        {deuxColonnes}
      </OverlayPleinEcran>
    </div>
  );
}

import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Database, Eye, FileWarning, Inbox, Link2, Loader2, Plus, Sunrise,
} from "lucide-react";
import { toast } from "sonner";
import { getPortalMenu } from "@/shared/config/menu";
import { cn } from "@/shared/lib/utils";
import { messageDonneesOuDefaut } from "@/shared/lib/message-utilisateur";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import {
  detailJourneeTresorerie,
  recettesJourValidees,
} from "@/portails/Sp/api/journees-tresorerie";
import {
  appliquerMontantsRealise,
  creerFicheExecutionJournee,
  trouverFicheExecutionJournee,
} from "@/portails/Sp/api/fiches-execution";
import { DialogAjoutNonProgramme } from "@/portails/Sp/components/fiche-matinale/DialogAjoutNonProgramme";
import { DialogRecettesOracle } from "@/portails/Sp/components/fiche-matinale/DialogRecettesOracle";
import { PreviewFicheExecutionDialog } from "@/portails/Sp/components/fiche-matinale/PreviewFicheExecutionDialog";
import { TableauFicheExecutionLecture } from "@/portails/Sp/components/fiche-execution/TableauFicheExecutionLecture";
import { OverlayPleinEcran } from "@/portails/Sp/components/plein-ecran/PleinEcran";
import {
  formaterMontantFcfa,
  formaterTauxRealise,
  styleIndentSection,
} from "@/portails/Sp/components/fiche-bleue/fiche-bleue-affichage";
import type {
  FicheExecutionDetail,
  SectionFicheExecution,
} from "@/portails/Sp/types/fiche-execution.interface";
import type { TypeSectionBibliotheque } from "@/portails/Sp/types/bibliotheque.interface";
import type {
  JourneeTresorerie,
  RecettesJourValidees,
} from "@/portails/Sp/types/journee-tresorerie.interface";

const MESSAGE_FICHE_EXECUTION_VIDE = "Aucune Fiche d'exécution.";

function estZero(valeur: string): boolean {
  const n = Number(valeur.replace(",", "."));
  return Number.isFinite(n) && n === 0;
}

function estNegatif(valeur: string): boolean {
  const n = Number(valeur.replace(",", "."));
  return Number.isFinite(n) && n < 0;
}

function normaliserMontant(brut: string): string {
  const n = Number(brut.replace(/\s/g, "").replace(",", "."));
  if (!Number.isFinite(n) || n < 0) return "0.00";
  return n.toFixed(2);
}

interface LigneAplat {
  id: number;
  nom: string;
  type: TypeSectionBibliotheque;
  niveau: number;
  programme: string;
  realise: string;
  ecart: string;
  estRacine: boolean;
  estFeuille: boolean;
  nonProgramme: boolean;
}

function aplatirSections(
  sections: SectionFicheExecution[],
  niveau = 0,
  typeRacine?: TypeSectionBibliotheque,
): LigneAplat[] {
  const out: LigneAplat[] = [];
  for (const s of sections) {
    const type = niveau === 0 ? s.type : (typeRacine ?? s.type);
    out.push({
      id: s.id,
      nom: s.nom,
      type,
      niveau,
      programme: s.montant_programme,
      realise: s.montant_realise,
      ecart: s.montant_ecart,
      estRacine: niveau === 0,
      estFeuille: s.sous_sections.length === 0,
      nonProgramme: Boolean(s.non_programme),
    });
    if (s.sous_sections.length > 0) {
      out.push(...aplatirSections(s.sous_sections, niveau + 1, type));
    }
  }
  return out;
}

function CelluleRealise({
  valeur,
  edition,
  disabled,
  onDemarrerEdition,
  onCommit,
  onAnnuler,
}: {
  valeur: string;
  edition: boolean;
  disabled: boolean;
  onDemarrerEdition: () => void;
  onCommit: (valeur: string) => void;
  onAnnuler: () => void;
}) {
  const [brouillon, setBrouillon] = useState(valeur);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!edition) setBrouillon(estZero(valeur) ? "" : valeur);
  }, [valeur, edition]);

  useEffect(() => {
    if (!edition) return;
    const el = inputRef.current;
    if (!el) return;
    el.focus();
    el.select();
  }, [edition]);

  function valider() {
    onCommit(normaliserMontant(brouillon));
  }

  if (edition && !disabled) {
    return (
      <Input
        ref={inputRef}
        value={brouillon}
        inputMode="decimal"
        onChange={(e) => setBrouillon(e.target.value)}
        onBlur={valider}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            valider();
          }
          if (e.key === "Escape") {
            setBrouillon(valeur);
            onAnnuler();
          }
        }}
        onClick={(e) => e.stopPropagation()}
        className="ml-auto h-7 w-full max-w-[140px] text-right tabular-nums"
        aria-label="Montant réalisé"
      />
    );
  }

  return (
    <span
      className={cn(
        "inline-block w-full text-right font-medium tabular-nums",
        !disabled && "cursor-text",
      )}
      title={disabled ? undefined : "Double-cliquer pour modifier le réalisé"}
      onDoubleClick={(e) => {
        if (disabled) return;
        e.stopPropagation();
        onDemarrerEdition();
      }}
    >
      {formaterMontantFcfa(valeur)}
    </span>
  );
}

function couleurEcart(ecart: string): string {
  if (estNegatif(ecart)) return "#b91c1c";
  const n = Number(ecart.replace(",", "."));
  if (Number.isFinite(n) && n > 0) return "#047857";
  return "#64748b";
}

const GRILLE_FE =
  "minmax(240px, 2fr) repeat(3, minmax(140px, 1fr)) 80px";

interface TabFicheExecutionProps {
  journee: JourneeTresorerie;
  onJourneeChange: (journee: JourneeTresorerie) => void;
  onFicheChange?: (fiche: FicheExecutionDetail | null) => void;
  /** Redirige vers la création / liaison d'une Fiche Bleue. */
  onCreerFicheBleue?: () => void;
  actif: boolean;
}

/**
 * Onglet Fiche d'exécution : cherche une fiche liée à la journée, sinon
 * la crée depuis la Fiche Bleue. Le Solde (programmé uniquement) est affiché
 * au-dessus du tableau recettes / dépenses (réalisé + écart).
 */
export function TabFicheExecution({
  journee,
  onJourneeChange,
  onFicheChange,
  onCreerFicheBleue,
  actif,
}: TabFicheExecutionProps) {
  const navigate = useNavigate();
  const theme = getPortalMenu("sp").theme;
  /** Journée clôturée (non réouverte) : consultation uniquement. */
  const cloturee = journee.etat === "cloture";
  const [chargement, setChargement] = useState(false);
  const [fiche, setFiche] = useState<FicheExecutionDetail | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [sectionEnEdition, setSectionEnEdition] = useState<number | null>(null);
  const [enregistrement, setEnregistrement] = useState(false);
  const [dialogAjoutOuvert, setDialogAjoutOuvert] = useState(false);
  const [dialogOracle, setDialogOracle] = useState(false);
  const [apercuOuvert, setApercuOuvert] = useState(false);
  const [pleinEcran, setPleinEcran] = useState(false);
  /** Liste de recettes déjà validée pour la journée → bouton = rapprochement. */
  const [recettesValidees, setRecettesValidees] = useState(false);

  const onJourneeChangeRef = useRef(onJourneeChange);
  const onFicheChangeRef = useRef(onFicheChange);
  onJourneeChangeRef.current = onJourneeChange;
  onFicheChangeRef.current = onFicheChange;

  useEffect(() => {
    if (!actif) setPleinEcran(false);
  }, [actif]);

  useEffect(() => {
    if (!actif) return;
    let annule = false;
    void recettesJourValidees(journee.reference)
      .then(({ recettes_jour }) => {
        if (!annule) setRecettesValidees(recettes_jour != null);
      })
      .catch(() => {
        if (!annule) setRecettesValidees(false);
      });
    return () => {
      annule = true;
    };
  }, [actif, journee.reference]);

  useEffect(() => {
    if (!pleinEcran) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setPleinEcran(false);
    }
    document.addEventListener("keydown", onKey);
    const overflowAvant = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflowAvant;
    };
  }, [pleinEcran]);

  useEffect(() => {
    if (!actif) {
      setFiche(null);
      setErreur(null);
      setChargement(false);
      setSectionEnEdition(null);
      onFicheChangeRef.current?.(null);
      return;
    }

    let annule = false;
    setChargement(true);
    setErreur(null);

    void (async () => {
      try {
        const { fiche: existante } = await trouverFicheExecutionJournee(
          journee.reference,
        );
        if (annule) return;

        if (existante) {
          setFiche(existante);
          onFicheChangeRef.current?.(existante);
          if (journee.fiche_execution_id !== existante.id) {
            const { journee: maj } = await detailJourneeTresorerie(
              journee.reference,
            );
            if (!annule) onJourneeChangeRef.current(maj);
          }
          return;
        }

        if (journee.fiche_bleue_id == null) {
          setFiche(null);
          onFicheChangeRef.current?.(null);
          setErreur(
            "Liez d'abord une Fiche Bleue à cette journée pour générer la Fiche d'exécution.",
          );
          return;
        }

        if (journee.etat === "cloture") {
          setFiche(null);
          onFicheChangeRef.current?.(null);
          setErreur(
            "Cette journée est clôturée : la Fiche d'exécution ne peut plus être créée.",
          );
          return;
        }

        const { fiche: creee } = await creerFicheExecutionJournee(
          journee.reference,
        );
        if (annule) return;
        setFiche(creee);
        onFicheChangeRef.current?.(creee);
        const { journee: maj } = await detailJourneeTresorerie(
          journee.reference,
        );
        if (!annule) onJourneeChangeRef.current(maj);
      } catch (e) {
        if (annule) return;
        setFiche(null);
        onFicheChangeRef.current?.(null);
        const message = messageDonneesOuDefaut(
          e instanceof Error ? e.message : null,
          "Impossible de charger la Fiche d'exécution.",
        );
        setErreur(message);
        toast.error(message);
      } finally {
        if (!annule) setChargement(false);
      }
    })();

    return () => {
      annule = true;
    };
  }, [actif, journee.reference, journee.fiche_bleue_id, journee.etat]);

  async function enregistrerRealise(
    sectionId: number,
    montant: string,
    actuel: string,
  ) {
    if (!fiche || enregistrement || cloturee) {
      setSectionEnEdition(null);
      return;
    }
    if (montant === normaliserMontant(actuel)) {
      setSectionEnEdition(null);
      return;
    }

    setEnregistrement(true);
    try {
      const { fiche: maj } = await appliquerMontantsRealise(fiche.id, [
        { section_id: sectionId, montant_realise: montant },
      ]);
      setFiche(maj);
      onFicheChangeRef.current?.(maj);
      const { journee: journeeMaj } = await detailJourneeTresorerie(
        journee.reference,
      );
      onJourneeChangeRef.current(journeeMaj);
      setSectionEnEdition(null);
    } catch (e) {
      toast.error(
        messageDonneesOuDefaut(
          e instanceof Error ? e.message : null,
          "Impossible d'enregistrer le montant réalisé.",
        ),
      );
    } finally {
      setEnregistrement(false);
    }
  }

  if (chargement) {
    return (
      <div className="flex min-h-[180px] items-center justify-center gap-2 text-muted-foreground">
        <Loader2 className="size-6 animate-spin" />
        <span className="text-[13px]">
          Préparation de la Fiche d&apos;exécution…
        </span>
      </div>
    );
  }

  if (erreur || !fiche) {
    const manqueFicheBleue = journee.fiche_bleue_id == null;
    return (
      <div className="flex min-h-[200px] flex-col items-center justify-center gap-3 px-4 text-center">
        <div
          className="flex size-12 items-center justify-center rounded-2xl"
          style={{ background: theme.iconBg, color: theme.iconColor }}
        >
          {erreur ? (
            <FileWarning className="size-6" />
          ) : (
            <Sunrise className="size-6" />
          )}
        </div>
        <p
          className="max-w-md text-[13.5px] leading-relaxed text-muted-foreground"
          role="status"
        >
          {erreur ?? MESSAGE_FICHE_EXECUTION_VIDE}
        </p>
        {manqueFicheBleue && onCreerFicheBleue && !cloturee ? (
          <Button
            type="button"
            size="sm"
            className="mt-1 gap-1.5 text-white hover:opacity-90"
            style={{ background: theme.ctaColor }}
            onClick={onCreerFicheBleue}
          >
            <Plus className="size-3.5" />
            Créer une Fiche Bleue
          </Button>
        ) : null}
      </div>
    );
  }

  const lignes = aplatirSections(fiche.sections);
  const heureMaj = fiche.date_dernier_mise_jour
    ? new Date(fiche.date_dernier_mise_jour).toLocaleTimeString("fr-FR", {
        hour: "2-digit",
        minute: "2-digit",
      })
    : null;

  const btnSecondaire =
    "flex h-[34px] items-center gap-1.5 rounded-md border border-[#e2e8f0] bg-white px-3 text-[13px] text-[#0f172a] hover:border-[#94a3b8]";

  return (
    <div className="flex flex-col overflow-hidden rounded-lg border border-[#e2e8f0] bg-white">
      <div
        className="flex flex-wrap items-center border-b border-[#e2e8f0]"
        style={{ gap: 12, padding: "14px 18px" }}
      >
        <div className="flex min-w-0 flex-col" style={{ gap: 2 }}>
          <span className="text-[15px] font-semibold text-[#0f172a]">
            Fiche d&apos;exécution{" "}
            <span
              className="font-normal text-[#64748b]"
              style={{
                fontFamily: '"IBM Plex Mono", ui-monospace, monospace',
                fontSize: 12,
              }}
            >
              {fiche.reference}
            </span>
          </span>
          <span className="text-[12.5px] text-[#64748b]">
            {heureMaj
              ? `Dernière mise à jour à ${heureMaj} · montants en FCFA`
              : "Montants en FCFA"}
          </span>
        </div>

        <div className="flex flex-wrap gap-2">
          {!recettesValidees ? (
            <button
              type="button"
              className={btnSecondaire}
              title="Sélectionner et valider les recettes Oracle du jour"
              onClick={() => setDialogOracle(true)}
            >
              <Database size={14} />
              Recettes Oracle
            </button>
          ) : null}
          <button
            type="button"
            className={btnSecondaire}
            onClick={() => setApercuOuvert(true)}
          >
            <Eye size={14} />
            Aperçu
          </button>
          <button
            type="button"
            className={btnSecondaire}
            disabled={cloturee}
            onClick={() => setDialogAjoutOuvert(true)}
          >
            <Plus size={14} />
            Hors programmation
          </button>
        </div>

        <div className="ml-auto flex flex-wrap gap-2">
          {recettesValidees ? (
            <button
              type="button"
              className={btnSecondaire}
              title="Rapprocher les recettes validées avec la Fiche d'exécution"
              onClick={() =>
                void navigate(
                  `/sp/fiche-matinale/rapprochement-recettes/${encodeURIComponent(journee.reference)}`,
                )
              }
            >
              <Link2 size={14} />
              Rapprochement des recettes
            </button>
          ) : null}
          <button
            type="button"
            className="flex h-[34px] items-center gap-1.5 rounded-md border px-3 text-[13px] font-semibold"
            style={{
              borderColor: theme.topColor,
              background: theme.bgColor,
              color: theme.textColor,
            }}
            onClick={() =>
              void navigate(
                `/sp/fiche-matinale/rapprochement-depenses/${encodeURIComponent(journee.reference)}`,
              )
            }
          >
            <Link2 size={14} />
            Rapprochement des dépenses
          </button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <div style={{ minWidth: 760 }}>
          <div
            className="grid items-center border-b border-[#e2e8f0] bg-[#f8fafc] text-[11.5px] font-semibold uppercase tracking-[0.06em] text-[#64748b]"
            style={{
              gridTemplateColumns: GRILLE_FE,
              gap: 12,
              padding: "9px 18px",
            }}
          >
            <span>Rubrique</span>
            <span className="text-right">Programmé</span>
            <span className="text-right">Réalisé</span>
            <span className="text-right">Écart</span>
            <span className="text-right">Taux</span>
          </div>

          {lignes.length === 0 ? (
            <div className="flex flex-col items-center gap-1.5 py-10 text-[#64748b]">
              <Inbox className="size-5" aria-hidden />
              <span className="text-[13px]">Aucune recette ni dépense.</span>
            </div>
          ) : (
            lignes.map((ligne) => {
              const editable =
                ligne.estFeuille &&
                ligne.type !== "solde" &&
                !enregistrement &&
                !cloturee;
              const afficherEcart =
                ligne.type !== "solde" && !estZero(ligne.realise);
              if (ligne.estRacine) {
                return (
                  <div
                    key={ligne.id}
                    className="grid items-center border-y border-[#e2e8f0] text-[12.5px] font-semibold uppercase tracking-[0.06em]"
                    style={{
                      gridTemplateColumns: GRILLE_FE,
                      gap: 12,
                      minHeight: 38,
                      padding: "0 18px",
                      background: theme.bgColor,
                      color: theme.textColor,
                    }}
                  >
                    <span>{ligne.nom}</span>
                    <span className="text-right tabular-nums tracking-normal">
                      {formaterMontantFcfa(ligne.programme)}
                    </span>
                    <span className="text-right tabular-nums tracking-normal">
                      {ligne.type === "solde"
                        ? formaterMontantFcfa(ligne.programme)
                        : formaterMontantFcfa(ligne.realise)}
                    </span>
                    <span />
                    <span />
                  </div>
                );
              }
              return (
                <div
                  key={ligne.id}
                  className="grid items-center border-b border-[#f1f5f9] text-[14px]"
                  style={{
                    gridTemplateColumns: GRILLE_FE,
                    gap: 12,
                    minHeight: 42,
                    padding: "0 18px 0 30px",
                    background: ligne.nonProgramme ? "#fffbeb" : "#fff",
                  }}
                  onDoubleClick={() => {
                    if (editable) setSectionEnEdition(ligne.id);
                  }}
                >
                  <span className="flex min-w-0 flex-wrap items-center gap-2">
                    <span
                      className="min-w-0 break-words whitespace-normal leading-snug"
                      style={styleIndentSection(Math.max(0, ligne.niveau - 1))}
                    >
                      {ligne.nom}
                    </span>
                    {ligne.nonProgramme ? (
                      <span className="text-[11px] font-semibold text-[#b45309]">
                        Hors programme
                      </span>
                    ) : null}
                  </span>
                  <span className="text-right tabular-nums text-[#475569]">
                    {formaterMontantFcfa(ligne.programme)}
                  </span>
                  <span className="text-right">
                    {ligne.type === "solde" ? (
                      <span className="tabular-nums font-medium">
                        {formaterMontantFcfa(ligne.programme)}
                      </span>
                    ) : (
                      <CelluleRealise
                        valeur={ligne.realise}
                        edition={sectionEnEdition === ligne.id}
                        disabled={!editable}
                        onDemarrerEdition={() => setSectionEnEdition(ligne.id)}
                        onAnnuler={() => setSectionEnEdition(null)}
                        onCommit={(montant) => {
                          void enregistrerRealise(
                            ligne.id,
                            montant,
                            ligne.realise,
                          );
                        }}
                      />
                    )}
                  </span>
                  <span
                    className="text-right tabular-nums"
                    style={{
                      color: afficherEcart
                        ? couleurEcart(ligne.ecart)
                        : "#64748b",
                    }}
                  >
                    {afficherEcart ? formaterMontantFcfa(ligne.ecart) : ""}
                  </span>
                  <span className="text-right tabular-nums text-[#64748b]">
                    {ligne.type === "solde"
                      ? ""
                      : formaterTauxRealise(ligne.programme, ligne.realise)}
                  </span>
                </div>
              );
            })
          )}
        </div>
      </div>

      <DialogAjoutNonProgramme
        fiche={fiche}
        ouvert={dialogAjoutOuvert}
        onClose={() => setDialogAjoutOuvert(false)}
        onAjoutee={(maj) => {
          setDialogAjoutOuvert(false);
          setFiche(maj);
          onFicheChangeRef.current?.(maj);
          void detailJourneeTresorerie(journee.reference).then(
            ({ journee: journeeMaj }) => {
              onJourneeChangeRef.current(journeeMaj);
            },
          );
        }}
      />
      <DialogRecettesOracle
        ouvert={dialogOracle}
        onClose={() => setDialogOracle(false)}
        referenceJournee={journee.reference}
        lectureSeule={cloturee}
        onValideeChange={(liste: RecettesJourValidees | null) => {
          setRecettesValidees(liste != null);
        }}
      />
      <PreviewFicheExecutionDialog
        ficheId={apercuOuvert ? fiche.id : null}
        onClose={() => setApercuOuvert(false)}
      />
      <OverlayPleinEcran
        ouvert={pleinEcran}
        titre="Fiche d'exécution"
        sousTitre={`${journee.reference}${fiche.reference ? ` · ${fiche.reference}` : ""}`}
        onClose={() => setPleinEcran(false)}
        ariaLabel="Fiche d'exécution en plein écran"
        masquerEnTete
        sansMarge
      >
        <TableauFicheExecutionLecture fiche={fiche} avecEnTete sansCadre />
      </OverlayPleinEcran>
    </div>
  );
}

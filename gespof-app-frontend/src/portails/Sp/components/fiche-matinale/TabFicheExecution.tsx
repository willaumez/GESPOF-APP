import { useEffect, useRef, useState } from "react";
import { FileWarning, Inbox, Loader2, Plus, Sunrise } from "lucide-react";
import { toast } from "sonner";
import { getPortalMenu } from "@/shared/config/menu";
import { cn } from "@/shared/lib/utils";
import { messageDonneesOuDefaut } from "@/shared/lib/message-utilisateur";
import { Badge } from "@/shared/components/ui/badge";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/shared/components/ui/table";
import { TooltipProvider } from "@/shared/components/ui/tooltip";
import { detailJourneeTresorerie } from "@/portails/Sp/api/journees-tresorerie";
import {
  appliquerMontantsRealise,
  creerFicheExecutionJournee,
  trouverFicheExecutionJournee,
} from "@/portails/Sp/api/fiches-execution";
import { DialogAjoutNonProgramme } from "@/portails/Sp/components/fiche-matinale/DialogAjoutNonProgramme";
import { TableauFicheExecutionExcel } from "@/portails/Sp/components/fiche-execution/TableauFicheExecutionExcel";
import {
  BoutonPleinEcran, OverlayPleinEcran,
} from "@/portails/Sp/components/plein-ecran/PleinEcran";
import { formaterMontantFcfa, styleIndentSection } from "@/portails/Sp/components/fiche-bleue/fiche-bleue-affichage";
import type {
  FicheExecutionDetail,
  SectionFicheExecution,
} from "@/portails/Sp/types/fiche-execution.interface";
import type { TypeSectionBibliotheque } from "@/portails/Sp/types/bibliotheque.interface";
import type { JourneeTresorerie } from "@/portails/Sp/types/journee-tresorerie.interface";

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

function fondLigne(
  type: TypeSectionBibliotheque,
  nonProgramme: boolean,
): string | undefined {
  if (nonProgramme) {
    if (type === "recette") return "bg-amber-50 hover:bg-amber-100/90";
    if (type === "depense") return "bg-orange-50 hover:bg-orange-100/90";
  }
  if (type === "recette") return "bg-emerald-50/80 hover:bg-emerald-50";
  if (type === "depense") return "bg-rose-50/80 hover:bg-rose-50";
  return undefined;
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
        className="ml-auto h-7 w-44 text-right tabular-nums"
        aria-label="Montant réalisé"
      />
    );
  }

  return (
    <span
      className={cn(
        "inline-block min-w-[11rem] rounded-md px-1 py-0.5 text-right font-semibold tabular-nums",
        !disabled && "cursor-text hover:bg-background/80",
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

const CLASSE_TABLE_ALIGNEE = "table-fixed";

function ColonneFicheExecution() {
  return (
    <colgroup>
      <col className="w-12" />
      <col />
      <col className="w-44" />
      <col className="w-56" />
      <col className="w-44" />
    </colgroup>
  );
}

function CelluleNomSection({ ligne }: { ligne: LigneAplat }) {
  return (
    <div
      className={cn(
        "flex min-w-0 items-center gap-2 font-medium",
        ligne.niveau > 0 &&
          "border-l-2 border-muted-foreground/25 text-muted-foreground",
        !ligne.estFeuille && "font-semibold",
      )}
      style={styleIndentSection(ligne.niveau)}
    >
      <span className="truncate">{ligne.nom}</span>
      {ligne.estRacine && ligne.type === "solde" ? (
        <Badge className="shrink-0 border-transparent bg-[#c9960a]/15 text-[10px] font-semibold uppercase tracking-wide text-[#8a6508]">
          Solde d&apos;ouverture
        </Badge>
      ) : null}
      {ligne.nonProgramme && (
        <Badge className="shrink-0 border-transparent bg-amber-200/90 text-[10px] font-semibold uppercase tracking-wide text-amber-950">
          Non programmé
        </Badge>
      )}
    </div>
  );
}

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
  const theme = getPortalMenu("sp").theme;
  /** Journée clôturée (non réouverte) : consultation uniquement. */
  const cloturee = journee.etat === "cloture";
  const [chargement, setChargement] = useState(false);
  const [fiche, setFiche] = useState<FicheExecutionDetail | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [sectionEnEdition, setSectionEnEdition] = useState<number | null>(null);
  const [enregistrement, setEnregistrement] = useState(false);
  const [dialogAjoutOuvert, setDialogAjoutOuvert] = useState(false);
  const [pleinEcran, setPleinEcran] = useState(false);

  const onJourneeChangeRef = useRef(onJourneeChange);
  const onFicheChangeRef = useRef(onFicheChange);
  onJourneeChangeRef.current = onJourneeChange;
  onFicheChangeRef.current = onFicheChange;

  useEffect(() => {
    if (!actif) setPleinEcran(false);
  }, [actif]);

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
  const lignesSolde = lignes.filter((l) => l.type === "solde");
  const lignesMouvements = lignes.filter((l) => l.type !== "solde");
  let ordreSolde = 0;
  let ordreMouvement = 0;

  function rendreBoutonAjouter() {
    return (
      <Button
        type="button"
        size="sm"
        className="shrink-0 gap-1.5 text-white hover:opacity-90"
        style={{ background: theme.ctaColor }}
        disabled={cloturee}
        title={cloturee ? "Journée clôturée : ajout impossible" : undefined}
        onClick={() => setDialogAjoutOuvert(true)}
      >
        <Plus className="size-3.5" />
        Ajouter
      </Button>
    );
  }

  const tableau = (
    <div className="overflow-hidden rounded-xl border-2 border-green-600/55">
      {lignesSolde.length > 0 ? (
        <Table
          className={CLASSE_TABLE_ALIGNEE}
          containerClassName="overflow-visible"
        >
          <ColonneFicheExecution />
          <TableBody className="[&_tr:last-child]:border-b">
            {lignesSolde.map((ligne) => {
              if (ligne.estRacine) ordreSolde += 1;
              return (
                <TableRow
                  key={ligne.id}
                  className={cn(
                    "hover:bg-transparent",
                    ligne.estRacine
                      ? "bg-[#fdf6e3]"
                      : "bg-sky-50/40",
                  )}
                >
                  <TableCell className="tabular-nums text-muted-foreground">
                    {ligne.estRacine ? ordreSolde : ""}
                  </TableCell>
                  <TableCell>
                    <CelluleNomSection ligne={ligne} />
                  </TableCell>
                  <TableCell
                    className={cn(
                      "text-right tabular-nums",
                      ligne.estRacine
                        ? "text-[15px] font-bold tracking-tight text-[#8a6508]"
                        : "font-semibold text-sky-950",
                    )}
                  >
                    {formaterMontantFcfa(ligne.programme)}
                  </TableCell>
                  <TableCell className="bg-background" aria-hidden />
                  <TableCell className="bg-background" aria-hidden />
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      ) : null}

      <Table
        className={CLASSE_TABLE_ALIGNEE}
        containerClassName={cn(
          "overflow-visible",
          lignesSolde.length > 0 && "border-t",
        )}
      >
        <ColonneFicheExecution />
        <TableHeader>
          <TableRow className="bg-muted/40 hover:bg-muted/40">
            <TableHead className="w-12">N°</TableHead>
            <TableHead>BANCAIRE</TableHead>
            <TableHead className="w-44 text-right">
              PROGRAMME (FCFA)
            </TableHead>
            <TableHead className="w-56 text-right">RÉALISÉ (FCFA)</TableHead>
            <TableHead className="w-44 text-right">ÉCART (FCFA)</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {lignesMouvements.length === 0 ? (
            <TableRow>
              <TableCell
                colSpan={5}
                className="py-10 text-center text-muted-foreground"
              >
                <span className="inline-flex flex-col items-center gap-1.5">
                  <Inbox className="size-5" aria-hidden />
                  <span className="text-[13px]">
                    Aucune recette ni dépense.
                  </span>
                </span>
              </TableCell>
            </TableRow>
          ) : (
            lignesMouvements.map((ligne) => {
              if (ligne.estRacine) ordreMouvement += 1;
              const editable = ligne.estFeuille && !enregistrement && !cloturee;
              const afficherEcart = !estZero(ligne.realise);
              return (
                <TableRow
                  key={ligne.id}
                  className={cn(
                    fondLigne(ligne.type, ligne.nonProgramme),
                    ligne.nonProgramme &&
                      ligne.type === "depense" &&
                      "border-l-4 border-l-orange-500",
                    ligne.nonProgramme &&
                      ligne.type === "recette" &&
                      "border-l-4 border-l-amber-500",
                    editable && "cursor-pointer",
                  )}
                  title={
                    editable
                      ? "Double-cliquer pour modifier le réalisé"
                      : ligne.estFeuille
                        ? undefined
                        : "Montant calculé à partir des sous-sections"
                  }
                  onDoubleClick={() => {
                    if (editable) setSectionEnEdition(ligne.id);
                  }}
                >
                  <TableCell className="tabular-nums text-muted-foreground">
                    {ligne.estRacine ? ordreMouvement : ""}
                  </TableCell>
                  <TableCell>
                    <CelluleNomSection ligne={ligne} />
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formaterMontantFcfa(ligne.programme)}
                  </TableCell>
                  <TableCell className="text-right">
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
                  </TableCell>
                  <TableCell
                    className={cn(
                      "text-right tabular-nums",
                      afficherEcart && estNegatif(ligne.ecart)
                        ? "font-medium text-red-600"
                        : "text-muted-foreground",
                    )}
                  >
                    {afficherEcart ? formaterMontantFcfa(ligne.ecart) : "—"}
                  </TableCell>
                </TableRow>
              );
            })
          )}
        </TableBody>
      </Table>
    </div>
  );

  return (
    <TooltipProvider>
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="min-w-0 flex-1 text-[12px] text-muted-foreground">
            {cloturee
              ? "Journée clôturée : la Fiche d'exécution est en lecture seule."
              : "Double-cliquez une ligne de recette ou de dépense pour saisir le réalisé. L'écart et les totaux des sections se recalculent automatiquement."}
          </p>
          <div className="flex shrink-0 items-center gap-1.5">
            <BoutonPleinEcran
              actif={pleinEcran}
              onToggle={() => setPleinEcran((v) => !v)}
              libelleEnter="Afficher la Fiche d'exécution en plein écran"
            />
            {rendreBoutonAjouter()}
          </div>
        </div>

        {!pleinEcran ? tableau : (
          <div className="flex min-h-[120px] items-center justify-center rounded-xl border border-dashed text-[13px] text-muted-foreground">
            Tableau affiché en plein écran
          </div>
        )}

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
      </div>

      <OverlayPleinEcran
        ouvert={pleinEcran}
        titre="Fiche d'exécution"
        sousTitre={`${journee.reference}${fiche.reference ? ` · ${fiche.reference}` : ""}`}
        onClose={() => setPleinEcran(false)}
        actions={rendreBoutonAjouter()}
        ariaLabel="Fiche d'exécution en plein écran"
      >
        <TableauFicheExecutionExcel fiche={fiche} />
      </OverlayPleinEcran>
    </TooltipProvider>
  );
}

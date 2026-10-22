import { useCallback, useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { createPortal } from "react-dom";
import {
  ArrowLeft, CornerDownRight, GripVertical, ListChecks, Loader2, Pin, Plus, Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { getPortalMenu } from "@/shared/config/menu";
import { cn } from "@/shared/lib/utils";
import { Button } from "@/shared/components/ui/button";
import { Checkbox } from "@/shared/components/ui/checkbox";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import { Skeleton } from "@/shared/components/ui/skeleton";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/shared/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/shared/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/shared/components/ui/table";
import { listerBibliothequeSections, creerSectionBibliotheque } from "@/portails/Sp/api/bibliotheque-sections";
import { ComboboxRechercheSection } from "@/portails/Sp/components/fiche-bleue/ComboboxRechercheSection";
import { LigneGroupeType } from "@/portails/Sp/components/fiche-bleue/LigneGroupeType";
import {
  estConteneurTypeSection,
  formaterMontantFcfa,
  idsCompositionDefaut,
  styleIndentSection,
} from "@/portails/Sp/components/fiche-bleue/fiche-bleue-affichage";
import { appliquerMontantsProgramme, creerFicheBleue, modifierFicheBleue, programmerFicheBleue } from "@/portails/Sp/api/fiches-bleues";
import type {
  NouvelleSousSectionPayload,
  SectionBibliotheque,
  TypeSectionBibliotheque,
} from "@/portails/Sp/types/bibliotheque.interface";
import type {
  CreerFicheBleuePayload, FicheBleueDetail, InsertionSectionPayload,
  ProgrammationFicheBleuePayload, SectionFicheBleue,
} from "@/portails/Sp/types/fiche-bleue.interface";

type ModeSolde = "existante" | "nouvelle";

/** Nœud d'édition des sous-sections d'une nouvelle Solde (dialog). */
interface NoeudSousSolde {
  cle: string;
  libelle: string;
  sousSections: NoeudSousSolde[];
}

let compteurSousSolde = 0;
function nouveauNoeudSousSolde(libelle = ""): NoeudSousSolde {
  compteurSousSolde += 1;
  return { cle: `local-ss-${Date.now()}-${compteurSousSolde}`, libelle, sousSections: [] };
}

function majNoeudSousSolde(
  noeuds: NoeudSousSolde[],
  cle: string,
  fn: (noeud: NoeudSousSolde) => NoeudSousSolde,
): NoeudSousSolde[] {
  return noeuds.map((noeud) => {
    if (noeud.cle === cle) return fn(noeud);
    return { ...noeud, sousSections: majNoeudSousSolde(noeud.sousSections, cle, fn) };
  });
}

function retirerNoeudSousSolde(noeuds: NoeudSousSolde[], cle: string): NoeudSousSolde[] {
  return noeuds
    .filter((noeud) => noeud.cle !== cle)
    .map((noeud) => ({
      ...noeud,
      sousSections: retirerNoeudSousSolde(noeud.sousSections, cle),
    }));
}

function libelleSousSoldeManquant(noeuds: NoeudSousSolde[]): boolean {
  return noeuds.some(
    (n) => n.libelle.trim() === "" || libelleSousSoldeManquant(n.sousSections),
  );
}

interface LigneComposition {
  cle: string;
  parentCle: string | null;
  libelle: string;
  typeCode: TypeSectionBibliotheque;
  niveau: number;
  bibliothequeId?: number;
  ficheSectionId?: number;
  sourceOperationCle?: string;
  montantProgramme: string;
  estSoldeEntete: boolean;
}

interface CreerFicheBleueVueProps {
  dateJour: Date;
  /** Si fourni, la vue préremplit la composition et enregistre sur cette fiche. */
  ficheExistante?: FicheBleueDetail | null;
  /** Masque titre / Retour et rend les actions dans `conteneurActions` (en-tête parent). */
  masquerEnTete?: boolean;
  conteneurActions?: HTMLElement | null;
  onAnnuler: () => void;
  onCreee: (fiche: FicheBleueDetail) => Promise<void> | void;
}

function normaliserMontant(brut: string): string {
  const n = Number(brut.replace(/\s/g, "").replace(",", "."));
  if (!Number.isFinite(n) || n < 0) return "0.00";
  return n.toFixed(2);
}

function estMontantZero(valeur: string): boolean {
  const n = Number(valeur.replace(/\s/g, "").replace(",", "."));
  return Number.isFinite(n) && n === 0;
}

function nouvelleCle(): string {
  return `local-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function aplatirSous(
  sous: SectionBibliotheque[],
  typeCode: TypeSectionBibliotheque,
  niveau: number,
  parentCle: string,
  cache: Map<string, LigneComposition>,
): LigneComposition[] {
  const lignes: LigneComposition[] = [];
  for (const s of sous) {
    const cle = `ss-${s.id}`;
    const existant = cache.get(cle);
    lignes.push({
      cle,
      parentCle,
      libelle: existant?.libelle ?? s.libelle,
      typeCode,
      niveau,
      bibliothequeId: s.id,
      ficheSectionId: existant?.ficheSectionId,
      sourceOperationCle: existant?.sourceOperationCle,
      montantProgramme: existant?.montantProgramme ?? "0.00",
      estSoldeEntete: false,
    });
    if (s.sous_sections.length > 0) {
      lignes.push(...aplatirSous(s.sous_sections, typeCode, niveau + 1, cle, cache));
    }
  }
  return lignes;
}

/** Collecte une ligne et toute sa descendance. */
function clesAvecDescendants(lignes: LigneComposition[], racine: string): Set<string> {
  const aSupprimer = new Set<string>([racine]);
  let change = true;
  while (change) {
    change = false;
    for (const l of lignes) {
      if (l.parentCle && aSupprimer.has(l.parentCle) && !aSupprimer.has(l.cle)) {
        aSupprimer.add(l.cle);
        change = true;
      }
    }
  }
  return aSupprimer;
}

function enfantsDirects(lignes: LigneComposition[], parentCle: string): LigneComposition[] {
  return lignes.filter((l) => l.parentCle === parentCle);
}

function peutDeposerSur(source: LigneComposition, cible: LigneComposition): boolean {
  if (source.cle === cible.cle) return false;
  if (source.estSoldeEntete || cible.estSoldeEntete) return false;
  if (source.niveau === 0) {
    return cible.niveau === 0 && cible.typeCode === source.typeCode && source.typeCode !== "solde";
  }
  return source.parentCle != null && source.parentCle === cible.parentCle;
}

/** Place le bloc (ligne + descendants) juste avant la cible, parmi ses sœurs. */
function reordonnerComposition(
  lignes: LigneComposition[],
  sourceCle: string,
  cibleCle: string,
): LigneComposition[] {
  const source = lignes.find((l) => l.cle === sourceCle);
  const cible = lignes.find((l) => l.cle === cibleCle);
  if (!source || !cible || !peutDeposerSur(source, cible)) return lignes;

  const duBloc = clesAvecDescendants(lignes, sourceCle);
  const bloc = lignes.filter((l) => duBloc.has(l.cle));
  const horsBloc = lignes.filter((l) => !duBloc.has(l.cle));
  const idxCible = horsBloc.findIndex((l) => l.cle === cibleCle);
  if (idxCible < 0) return lignes;
  const suite = [...horsBloc];
  suite.splice(idxCible, 0, ...bloc);
  return recalculerMontantsParents(suite);
}

function trierCommePrecedent(
  enfants: LigneComposition[],
  parentCle: string | null,
  precedentes: LigneComposition[],
): LigneComposition[] {
  const ordrePrec = precedentes
    .filter((l) => l.parentCle === parentCle)
    .map((l) => l.cle);
  if (ordrePrec.length === 0) return enfants;
  return [...enfants].sort((a, b) => {
    const ia = ordrePrec.indexOf(a.cle);
    const ib = ordrePrec.indexOf(b.cle);
    const ra = ia === -1 ? Number.MAX_SAFE_INTEGER : ia;
    const rb = ib === -1 ? Number.MAX_SAFE_INTEGER : ib;
    return ra - rb;
  });
}

function attacherIdsServeur(
  lignes: LigneComposition[],
  sections: SectionFicheBleue[],
): LigneComposition[] {
  const parCle = new Map(lignes.map((l) => [l.cle, { ...l }]));

  function marcher(parentCle: string | null, srv: SectionFicheBleue[]) {
    const locaux = parentCle == null
      ? lignes.filter((l) => l.niveau === 0)
      : enfantsDirects(lignes, parentCle);
    const restants = [...srv];
    for (const local of locaux) {
      const idx = restants.findIndex(
        (s) => s.nom === local.libelle && s.type === local.typeCode,
      );
      if (idx < 0) continue;
      const [s] = restants.splice(idx, 1);
      const maj = parCle.get(local.cle);
      if (maj) maj.ficheSectionId = s.id;
      marcher(local.cle, s.sous_sections);
    }
  }
  marcher(null, sections);
  return lignes.map((l) => parCle.get(l.cle) ?? l);
}

function trouverNoeudBiblio(
  sections: SectionBibliotheque[],
  id: number,
): SectionBibliotheque | undefined {
  for (const s of sections) {
    if (s.id === id) return s;
    const dans = trouverNoeudBiblio(s.sous_sections, id);
    if (dans) return dans;
  }
  return undefined;
}

function trouverParentBiblio(
  sections: SectionBibliotheque[],
  id: number,
): SectionBibliotheque | undefined {
  for (const s of sections) {
    if (s.sous_sections.some((e) => e.id === id)) return s;
    const dans = trouverParentBiblio(s.sous_sections, id);
    if (dans) return dans;
  }
  return undefined;
}

function lignesVersNoeudsSousSolde(
  lignes: LigneComposition[],
  parentCle: string,
): NoeudSousSolde[] {
  return enfantsDirects(lignes, parentCle).map((l) => ({
    cle: l.cle.startsWith("local-") ? l.cle : `local-${l.cle}`,
    libelle: l.libelle,
    sousSections: lignesVersNoeudsSousSolde(lignes, l.cle),
  }));
}

function aplatirNoeudsSousSolde(
  noeuds: NoeudSousSolde[],
  parentCle: string,
  niveau: number,
  cache: Map<string, LigneComposition>,
): LigneComposition[] {
  const lignes: LigneComposition[] = [];
  for (const n of noeuds) {
    const existant = cache.get(n.cle);
    lignes.push({
      cle: n.cle,
      parentCle,
      libelle: existant?.libelle ?? (n.libelle.trim() || "Nouvelle sous-section"),
      typeCode: "solde",
      niveau,
      ficheSectionId: existant?.ficheSectionId,
      sourceOperationCle: existant?.sourceOperationCle,
      montantProgramme: existant?.montantProgramme ?? "0.00",
      estSoldeEntete: false,
    });
    if (n.sousSections.length > 0) {
      lignes.push(...aplatirNoeudsSousSolde(n.sousSections, n.cle, niveau + 1, cache));
    }
  }
  return lignes;
}

function appartientSousArbreSolde(
  ligne: LigneComposition,
  all: LigneComposition[],
): boolean {
  let parent = ligne.parentCle;
  while (parent) {
    if (parent === "solde") return true;
    parent = all.find((l) => l.cle === parent)?.parentCle ?? null;
  }
  return false;
}

/** Payload API des sous-sections Solde depuis la composition. */
function sousSectionsDepuisLignes(
  lignes: LigneComposition[],
  parentCle: string,
): NouvelleSousSectionPayload[] {
  return enfantsDirects(lignes, parentCle).map((l) => {
    const enfants = sousSectionsDepuisLignes(lignes, l.cle);
    const libelle = l.libelle.trim();
    return enfants.length > 0
      ? { libelle, sous_sections: enfants }
      : { libelle };
  });
}

/** Parents = somme des enfants (feuilles saisies). Recalcule du bas vers le haut. */
function recalculerMontantsParents(lignes: LigneComposition[]): LigneComposition[] {
  const parCle = new Map(lignes.map((l) => [l.cle, { ...l }]));
  const ordonnees = [...parCle.values()].sort((a, b) => b.niveau - a.niveau);

  for (const noeud of ordonnees) {
    const enfants = [...parCle.values()].filter((l) => l.parentCle === noeud.cle);
    if (enfants.length === 0) continue;
    const somme = enfants.reduce(
      (acc, e) => acc + Number(e.montantProgramme.replace(",", ".")),
      0,
    );
    const maj = parCle.get(noeud.cle)!;
    maj.montantProgramme = Number.isFinite(somme) ? somme.toFixed(2) : "0.00";
  }

  return lignes.map((l) => parCle.get(l.cle) ?? l);
}

function extraireProgrammation(lignes: LigneComposition[]): ProgrammationFicheBleuePayload {
  const mises_a_jour = lignes
    .filter((l) => l.ficheSectionId != null)
    .map((l) => {
      const feuille = enfantsDirects(lignes, l.cle).length === 0;
      const fratrie = l.parentCle
        ? enfantsDirects(lignes, l.parentCle)
        : lignes.filter((x) => x.niveau === 0);
      const ordre = fratrie.findIndex((x) => x.cle === l.cle) + 1;
      return {
        section_id: l.ficheSectionId!,
        nom: l.libelle.trim(),
        ordre,
        ...(feuille ? { montant_programme: normaliserMontant(l.montantProgramme) } : {}),
      };
    });

  function arbreInsertion(
    ligne: LigneComposition,
    parentId: number | null,
    position: number,
  ): InsertionSectionPayload {
    const enfants = enfantsDirects(lignes, ligne.cle);
    const enfantsLocaux = enfants.filter((e) => e.ficheSectionId == null);
    return {
      parent_id: parentId,
      position,
      nom: ligne.libelle.trim() || "Nouvelle ligne",
      type: ligne.typeCode,
      montant_programme: enfants.length === 0
        ? normaliserMontant(ligne.montantProgramme)
        : "0.00",
      enfants: enfantsLocaux.map((e, i) => arbreInsertion(e, null, i + 1)),
    };
  }

  const insertions: InsertionSectionPayload[] = [];

  function parcourir(parent: LigneComposition | null) {
    const enfants = parent
      ? enfantsDirects(lignes, parent.cle)
      : lignes.filter((l) => l.niveau === 0);
    enfants.forEach((enfant, i) => {
      if (enfant.ficheSectionId == null && !enfant.estSoldeEntete) {
        insertions.push(arbreInsertion(enfant, parent?.ficheSectionId ?? null, i + 1));
      } else {
        parcourir(enfant);
      }
    });
  }
  parcourir(null);

  return { mises_a_jour, insertions };
}

function sectionsFicheVersLignes(
  sections: SectionFicheBleue[],
  soldes: SectionBibliotheque[] = [],
  autres: SectionBibliotheque[] = [],
  niveau = 0,
  parentCle: string | null = null,
): LigneComposition[] {
  const lignes: LigneComposition[] = [];
  for (const s of sections) {
    const estSoldeEntete = niveau === 0 && s.type === "solde";
    const bibliothequeId = estSoldeEntete
      ? soldes.find((b) => b.libelle === s.nom)?.id
      : niveau === 0
        ? autres.find((a) => a.libelle === s.nom && a.type === s.type)?.id
        : undefined;
    const cle = estSoldeEntete
      ? "solde"
      : bibliothequeId != null
        ? `sec-${bibliothequeId}`
        : `fb-${s.id}`;
    lignes.push({
      cle,
      parentCle,
      libelle: s.nom,
      typeCode: s.type,
      niveau,
      bibliothequeId,
      ficheSectionId: s.id,
      montantProgramme: s.montant_programme,
      estSoldeEntete,
    });
    if (s.sous_sections.length > 0) {
      lignes.push(...sectionsFicheVersLignes(s.sous_sections, soldes, autres, niveau + 1, cle));
    }
  }
  return lignes;
}

function matcherBibliothequeFiche(
  fiche: FicheBleueDetail,
  soldes: SectionBibliotheque[],
  autres: SectionBibliotheque[],
): {
  modeSolde: ModeSolde;
  soldeId: string;
  libelleSolde: string;
  autresIds: number[];
} {
  const solde = fiche.sections.find((s) => s.type === "solde");
  const soldeBib = solde
    ? soldes.find((s) => s.libelle === solde.nom)
    : undefined;
  const autresIds = fiche.sections
    .filter((s) => s.type !== "solde")
    .map((s) => autres.find((a) => a.libelle === s.nom && a.type === s.type)?.id)
    .filter((id): id is number => id != null);

  return {
    modeSolde: soldeBib ? "existante" : "nouvelle",
    soldeId: soldeBib ? String(soldeBib.id) : "",
    libelleSolde: solde?.nom ?? "SOLDES BANCAIRES D'OUVERTURE",
    autresIds,
  };
}

function CelluleEditable({
  valeur,
  className,
  style,
  align = "left",
  type = "text",
  disabled,
  title,
  onCommit,
}: {
  valeur: string;
  className?: string;
  style?: CSSProperties;
  align?: "left" | "right";
  type?: "text" | "montant";
  disabled?: boolean;
  title?: string;
  onCommit: (valeur: string) => void;
}) {
  const [edition, setEdition] = useState(false);
  const [brouillon, setBrouillon] = useState(valeur);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!edition) setBrouillon(valeur);
  }, [valeur, edition]);

  useEffect(() => {
    if (edition) inputRef.current?.focus();
  }, [edition]);

  function valider() {
    const prochaine = type === "montant" ? normaliserMontant(brouillon) : brouillon.trim() || valeur;
    onCommit(prochaine);
    setEdition(false);
  }

  if (edition && !disabled) {
    return (
      <Input
        ref={inputRef}
        value={brouillon}
        onChange={(e) => setBrouillon(e.target.value)}
        onBlur={valider}
        onKeyDown={(e) => {
          if (e.key === "Enter") valider();
          if (e.key === "Escape") {
            setBrouillon(valeur);
            setEdition(false);
          }
        }}
        className={cn("h-8", align === "right" && "text-right tabular-nums", className)}
      />
    );
  }

  return (
    <button
      type="button"
      disabled={disabled}
      title={title ?? (disabled ? undefined : "Double-cliquer pour modifier")}
      onDoubleClick={() => {
        if (disabled) return;
        setBrouillon(
          type === "montant" && estMontantZero(valeur) ? "" : valeur,
        );
        setEdition(true);
      }}
      className={cn(
        "block w-full rounded-md px-1 py-0.5 text-left hover:bg-muted/60 disabled:cursor-default disabled:hover:bg-transparent",
        align === "right" && "text-right font-semibold tabular-nums",
        className,
      )}
      style={style}
    >
      {type === "montant" ? formaterMontantFcfa(valeur) : valeur}
    </button>
  );
}

const CLASSE_BARRE_OUTILS_FB =
  "flex min-h-[3.75rem] items-end bg-background pb-2";

/**
 * Création inline Fiche Bleue : composition dans l'onglet, sélection via dialog,
 * mode Édition pour ajouter / supprimer sections et sous-sections.
 */
export function CreerFicheBleueVue({
  dateJour,
  ficheExistante = null,
  masquerEnTete = false,
  conteneurActions = null,
  onAnnuler,
  onCreee,
}: CreerFicheBleueVueProps) {
  const theme = getPortalMenu("sp").theme;
  const dateLibelle = dateJour.toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });

  const [chargement, setChargement] = useState(true);
  const [soldes, setSoldes] = useState<SectionBibliotheque[]>([]);
  const [autresDispo, setAutresDispo] = useState<SectionBibliotheque[]>([]);
  const [dialogOuvert, setDialogOuvert] = useState(false);
  const modeEdition = true;

  const [modeSolde, setModeSolde] = useState<ModeSolde>("existante");
  const [soldeId, setSoldeId] = useState("");
  const [nouveauLibelleSolde, setNouveauLibelleSolde] = useState("SOLDES BANCAIRES D'OUVERTURE");
  const [ordreAutresIds, setOrdreAutresIds] = useState<number[]>([]);

  const [brouillonModeSolde, setBrouillonModeSolde] = useState<ModeSolde>("existante");
  const [brouillonSoldeId, setBrouillonSoldeId] = useState("");
  const [brouillonNouveauLibelle, setBrouillonNouveauLibelle] = useState("SOLDES BANCAIRES D'OUVERTURE");
  const [brouillonAutresIds, setBrouillonAutresIds] = useState<number[]>([]);
  const [brouillonSousSolde, setBrouillonSousSolde] = useState<NoeudSousSolde[]>([]);

  const [lignes, setLignes] = useState<LigneComposition[]>([]);
  const [enDragCle, setEnDragCle] = useState<string | null>(null);
  const [survolCle, setSurvolCle] = useState<string | null>(null);
  const [enregistrement, setEnregistrement] = useState(false);
  const [recompositionRequise, setRecompositionRequise] = useState(false);
  const [creationBiblioEnCours, setCreationBiblioEnCours] = useState(false);
  const sauterReconstructionRef = useRef(Boolean(ficheExistante));
  const ficheInitialiseeRef = useRef(false);

  const chargerBibliotheque = useCallback((conserverSelection = false) => {
    setChargement(!conserverSelection);
    return Promise.all([
      listerBibliothequeSections({ type: "solde", page: 1, limite: 500 }),
      listerBibliothequeSections({ type: "recette", page: 1, limite: 500 }),
      listerBibliothequeSections({ type: "depense", page: 1, limite: 500 }),
    ])
      .then(([pageSolde, pageRecette, pageDepense]) => {
        const listeSoldes = pageSolde.sections ?? [];
        const racinesRecettes = pageRecette.sections ?? [];
        const racinesDepenses = pageDepense.sections ?? [];
        setSoldes(listeSoldes);
        setAutresDispo([...racinesRecettes, ...racinesDepenses]);
        if (ficheExistante || conserverSelection) return;

        setOrdreAutresIds(idsCompositionDefaut(racinesRecettes, racinesDepenses));

        if (listeSoldes.length > 0) {
          const soldeCanon =
            listeSoldes.find((s) => s.libelle === "SOLDES BANCAIRES D'OUVERTURE")
            ?? listeSoldes[0];
          setModeSolde("existante");
          setSoldeId((prev) => prev || String(soldeCanon.id));
          setBrouillonModeSolde("existante");
          setBrouillonSoldeId((prev) => prev || String(soldeCanon.id));
        } else {
          setModeSolde("nouvelle");
          setBrouillonModeSolde("nouvelle");
        }
      })
      .catch(() => {
        toast.error("Impossible de charger la bibliothèque des sections.");
      })
      .finally(() => setChargement(false));
  }, [ficheExistante]);

  useEffect(() => {
    void chargerBibliotheque();
  }, [chargerBibliotheque]);

  const sectionParId = useCallback(
    (id: number): SectionBibliotheque | undefined => autresDispo.find((s) => s.id === id),
    [autresDispo],
  );

  const reconstruireLignes = useCallback(
    (
      mode: ModeSolde,
      idSolde: string,
      libelleNouvelle: string,
      idsAutres: number[],
      precedentes: LigneComposition[],
    ): LigneComposition[] => {
    const cache = new Map(
      precedentes.map((l) => [l.cle, l]),
    );
      // Conserver les sous-sections ajoutées manuellement (cles local-*).
      const manuelles = precedentes.filter((l) => l.cle.startsWith("local-"));
      const resultat: LigneComposition[] = [];

      const soldeChoisie = mode === "existante"
        ? soldes.find((s) => String(s.id) === idSolde)
        : null;
      const libelleSolde = mode === "nouvelle"
        ? (libelleNouvelle.trim() || "Nouvelle section Solde…")
        : (soldeChoisie?.libelle ?? "Section Solde…");
      const existantSolde = cache.get("solde");

      resultat.push({
        cle: "solde",
        parentCle: null,
        libelle: mode === "nouvelle"
          ? (existantSolde?.libelle ?? libelleSolde)
          : (existantSolde?.libelle ?? libelleSolde),
        typeCode: "solde",
        niveau: 0,
        bibliothequeId: soldeChoisie?.id,
        ficheSectionId: existantSolde?.ficheSectionId,
        sourceOperationCle: existantSolde?.sourceOperationCle,
        montantProgramme: existantSolde?.montantProgramme ?? "0.00",
        estSoldeEntete: true,
      });

      if (soldeChoisie?.sous_sections?.length) {
        resultat.push(...aplatirSous(soldeChoisie.sous_sections, "solde", 1, "solde", cache));
      }

      const recettes = idsAutres
        .map((id) => sectionParId(id))
        .filter((s): s is SectionBibliotheque => s != null && s.type === "recette");
      const depenses = idsAutres
        .map((id) => sectionParId(id))
        .filter((s): s is SectionBibliotheque => s != null && s.type === "depense");

      for (const s of [...recettes, ...depenses]) {
        const cle = `sec-${s.id}`;
        const existant = cache.get(cle);
        resultat.push({
          cle,
          parentCle: null,
          libelle: existant?.libelle ?? s.libelle,
          typeCode: s.type,
          niveau: 0,
          bibliothequeId: s.id,
          ficheSectionId: existant?.ficheSectionId,
          sourceOperationCle: existant?.sourceOperationCle,
          montantProgramme: existant?.montantProgramme ?? "0.00",
          estSoldeEntete: false,
        });
        if (s.sous_sections.length > 0) {
          resultat.push(...aplatirSous(s.sous_sections, s.type, 1, cle, cache));
        }
      }

      // Réinsérer les lignes manuelles dont le parent existe encore (multi-passe).
      const clesResultat = new Set(resultat.map((l) => l.cle));
      let change = true;
      while (change) {
        change = false;
        for (const m of manuelles) {
          if (
            m.parentCle
            && clesResultat.has(m.parentCle)
            && !clesResultat.has(m.cle)
          ) {
            resultat.push(m);
            clesResultat.add(m.cle);
            change = true;
          }
        }
      }

      // Ordre d'affichage : solde (+ enfants) puis recettes (+ enfants) puis dépenses.
      const racines = resultat.filter((l) => l.niveau === 0);
      const enfantsDe = (parent: string) =>
        trierCommePrecedent(
          resultat.filter((l) => l.parentCle === parent),
          parent,
          precedentes,
        );

      function aplatirDepuis(racine: LigneComposition): LigneComposition[] {
        const out = [racine];
        const file = [...enfantsDe(racine.cle)];
        while (file.length > 0) {
          const n = file.shift()!;
          out.push(n);
          file.unshift(...enfantsDe(n.cle));
        }
        return out;
      }

      const ordre: LigneComposition[] = [];
      for (const r of racines.filter((r) => r.typeCode === "solde")) ordre.push(...aplatirDepuis(r));
      for (const r of racines.filter((r) => r.typeCode === "recette")) ordre.push(...aplatirDepuis(r));
      for (const r of racines.filter((r) => r.typeCode === "depense")) ordre.push(...aplatirDepuis(r));
      return recalculerMontantsParents(ordre);
    },
    [sectionParId, soldes],
  );

  useEffect(() => {
    if (chargement) return;
    if (sauterReconstructionRef.current) {
      sauterReconstructionRef.current = false;
      return;
    }
    setLignes((prev) =>
      reconstruireLignes(modeSolde, soldeId, nouveauLibelleSolde, ordreAutresIds, prev),
    );
  }, [
    chargement,
    modeSolde,
    soldeId,
    nouveauLibelleSolde,
    ordreAutresIds,
    reconstruireLignes,
  ]);

  useEffect(() => {
    if (chargement || !ficheExistante || ficheInitialiseeRef.current) return;
    ficheInitialiseeRef.current = true;
    sauterReconstructionRef.current = true;
    const match = matcherBibliothequeFiche(ficheExistante, soldes, autresDispo);
    setModeSolde(match.modeSolde);
    setSoldeId(match.soldeId);
    setNouveauLibelleSolde(match.libelleSolde);
    setOrdreAutresIds(match.autresIds);
    setBrouillonModeSolde(match.modeSolde);
    setBrouillonSoldeId(match.soldeId);
    setBrouillonNouveauLibelle(match.libelleSolde);
    setBrouillonAutresIds(match.autresIds);
    setLignes(recalculerMontantsParents(
      sectionsFicheVersLignes(ficheExistante.sections, soldes, autresDispo),
    ));
  }, [chargement, ficheExistante, soldes, autresDispo]);

  function ouvrirDialog() {
    setBrouillonModeSolde(modeSolde);
    setBrouillonSoldeId(soldeId);
    setBrouillonNouveauLibelle(nouveauLibelleSolde);
    setBrouillonAutresIds([...ordreAutresIds]);
    setBrouillonSousSolde(
      modeSolde === "nouvelle" ? lignesVersNoeudsSousSolde(lignes, "solde") : [],
    );
    setDialogOuvert(true);
  }

  function appliquerSelection() {
    if (brouillonModeSolde === "existante") {
      const id = Number(brouillonSoldeId);
      if (!Number.isFinite(id) || id <= 0) {
        toast.error("Sélectionnez une section Solde d'en-tête.");
        return;
      }
    } else if (brouillonNouveauLibelle.trim() === "") {
      toast.error("Donnez un libellé à la nouvelle section Solde.");
      return;
    } else if (libelleSousSoldeManquant(brouillonSousSolde)) {
      toast.error("Toutes les sous-sections de la Solde doivent avoir un libellé.");
      return;
    }

    const tries = brouillonAutresIds
      .map((id) => sectionParId(id))
      .filter((s): s is SectionBibliotheque => s != null);
    const idsOrdonnes = [
      ...tries.filter((s) => s.type === "recette").map((s) => s.id),
      ...tries.filter((s) => s.type === "depense").map((s) => s.id),
    ];

    setModeSolde(brouillonModeSolde);
    setSoldeId(brouillonSoldeId);
    setNouveauLibelleSolde(brouillonNouveauLibelle);
    setOrdreAutresIds(idsOrdonnes);
    setRecompositionRequise(true);
    setDialogOuvert(false);

    setLignes((prev) => {
      const rebuilt = reconstruireLignes(
        brouillonModeSolde,
        brouillonSoldeId,
        brouillonNouveauLibelle,
        idsOrdonnes,
        prev,
      );
      if (brouillonModeSolde !== "nouvelle") return rebuilt;

      const cache = new Map(prev.map((l) => [l.cle, l]));
      const horsEnfantsSolde = rebuilt.filter(
        (l) => l.cle === "solde" || !appartientSousArbreSolde(l, rebuilt),
      );
      const soldeLigne = horsEnfantsSolde.find((l) => l.cle === "solde");
      if (!soldeLigne) return rebuilt;
      const autres = horsEnfantsSolde.filter((l) => l.cle !== "solde");
      const sous = aplatirNoeudsSousSolde(brouillonSousSolde, "solde", 1, cache);

      function avecEnfants(racine: LigneComposition, pool: LigneComposition[]): LigneComposition[] {
        const out = [racine];
        for (const e of pool.filter((l) => l.parentCle === racine.cle)) {
          out.push(...avecEnfants(e, pool));
        }
        return out;
      }

      const poolAutres = autres;
      const ordre: LigneComposition[] = [soldeLigne, ...sous];
      for (const r of poolAutres.filter((l) => l.niveau === 0 && l.typeCode === "recette")) {
        ordre.push(...avecEnfants(r, poolAutres));
      }
      for (const r of poolAutres.filter((l) => l.niveau === 0 && l.typeCode === "depense")) {
        ordre.push(...avecEnfants(r, poolAutres));
      }
      return recalculerMontantsParents(ordre);
    });
  }

  function basculerBrouillonAutre(id: number, coche: boolean) {
    setBrouillonAutresIds((prev) => {
      if (coche) return prev.includes(id) ? prev : [...prev, id];
      return prev.filter((x) => x !== id);
    });
  }

  function majLigne(
    cle: string,
    patch: Partial<Pick<LigneComposition, "libelle" | "montantProgramme" | "sourceOperationCle">>,
  ) {
    setLignes((prev) => {
      const maj = prev.map((l) => (l.cle === cle ? { ...l, ...patch } : l));
      return patch.montantProgramme !== undefined ? recalculerMontantsParents(maj) : maj;
    });
    if (cle === "solde" && patch.libelle !== undefined && modeSolde === "nouvelle") {
      setNouveauLibelleSolde(patch.libelle);
    }
  }

  function ajouterSousSection(parent: LigneComposition, libelle = "Nouvelle sous-section") {
    const cle = nouvelleCle();
    const enfant: LigneComposition = {
      cle,
      parentCle: parent.cle,
      libelle,
      typeCode: parent.typeCode,
      niveau: parent.niveau + 1,
      montantProgramme: "0.00",
      estSoldeEntete: false,
    };
    setLignes((prev) => {
      const idx = prev.findIndex((l) => l.cle === parent.cle);
      if (idx < 0) return recalculerMontantsParents([...prev, enfant]);
      let insertAt = idx + 1;
      while (insertAt < prev.length && prev[insertAt].niveau > parent.niveau) {
        insertAt += 1;
      }
      const suite = [...prev];
      suite.splice(insertAt, 0, enfant);
      return recalculerMontantsParents(suite);
    });
  }

  function insererNoeudBibliotheque(
    section: SectionBibliotheque,
    parent: LigneComposition | null,
  ) {
    setLignes((prev) => {
      if (prev.some((l) => l.bibliothequeId === section.id)) {
        return prev;
      }
      const cache = new Map<string, LigneComposition>();
      const parentCle = parent?.cle ?? null;
      const niveau = parent ? parent.niveau + 1 : 0;
      const cle = parent ? `ss-${section.id}` : `sec-${section.id}`;
      const racine: LigneComposition = {
        cle,
        parentCle,
        libelle: section.libelle,
        typeCode: parent?.typeCode ?? section.type,
        niveau,
        bibliothequeId: section.id,
        montantProgramme: "0.00",
        estSoldeEntete: false,
      };
      const descendants = section.sous_sections.length > 0
        ? aplatirSous(section.sous_sections, racine.typeCode, niveau + 1, cle, cache)
        : [];
      const bloc = [racine, ...descendants];
      if (!parent) {
        function avecEnfants(r: LigneComposition, all: LigneComposition[]): LigneComposition[] {
          const out = [r];
          for (const e of all.filter((l) => l.parentCle === r.cle)) {
            out.push(...avecEnfants(e, all));
          }
          return out;
        }
        const typeCode = racine.typeCode;
        const out: LigneComposition[] = [];
        for (const r of prev.filter((l) => l.niveau === 0 && l.typeCode === "solde")) {
          out.push(...avecEnfants(r, prev));
        }
        const recettes = typeCode === "recette"
          ? [...prev.filter((l) => l.niveau === 0 && l.typeCode === "recette"), racine]
          : prev.filter((l) => l.niveau === 0 && l.typeCode === "recette");
        const poolR = typeCode === "recette" ? [...prev, ...bloc] : prev;
        for (const r of recettes) out.push(...avecEnfants(r, poolR));
        const depenses = typeCode === "depense"
          ? [...prev.filter((l) => l.niveau === 0 && l.typeCode === "depense"), racine]
          : prev.filter((l) => l.niveau === 0 && l.typeCode === "depense");
        const poolD = typeCode === "depense" ? [...prev, ...bloc] : prev;
        for (const r of depenses) out.push(...avecEnfants(r, poolD));
        return recalculerMontantsParents(out);
      }
      const idx = prev.findIndex((l) => l.cle === parent.cle);
      if (idx < 0) return recalculerMontantsParents([...prev, ...bloc]);
      let insertAt = idx + 1;
      while (insertAt < prev.length && prev[insertAt].niveau > parent.niveau) {
        insertAt += 1;
      }
      const suite = [...prev];
      suite.splice(insertAt, 0, ...bloc);
      return recalculerMontantsParents(suite);
    });
    if (parent == null && section.type !== "solde") {
      setOrdreAutresIds((ids) => (ids.includes(section.id) ? ids : [...ids, section.id]));
    }
  }

  function choisirSectionRecherche(
    section: SectionBibliotheque,
    parentLigne: LigneComposition | null,
  ) {
    if (lignes.some((l) => l.bibliothequeId === section.id)) {
      toast.info(`« ${section.libelle} » est déjà dans la composition.`);
      return;
    }
    if (parentLigne) {
      insererNoeudBibliotheque(section, parentLigne);
      return;
    }
    const parentBiblio = trouverParentBiblio(autresDispo, section.id);
    const parentLigneExistante = parentBiblio
      ? lignes.find((l) => l.bibliothequeId === parentBiblio.id) ?? null
      : null;
    insererNoeudBibliotheque(section, parentLigneExistante);
  }

  function remplacerLigneParSection(ligne: LigneComposition, section: SectionBibliotheque) {
    if (ligne.bibliothequeId === section.id) return;
    if (lignes.some((l) => l.bibliothequeId === section.id)) {
      toast.info(`« ${section.libelle} » est déjà dans la composition.`);
      return;
    }
    if (ligne.niveau === 0 && ligne.typeCode !== "solde") {
      if (ligne.bibliothequeId != null) {
        setOrdreAutresIds((ids) =>
          ids.map((id) => (id === ligne.bibliothequeId ? section.id : id)),
        );
        return;
      }
      insererNoeudBibliotheque(section, null);
      setLignes((prev) => {
        const aOter = clesAvecDescendants(prev, ligne.cle);
        return recalculerMontantsParents(prev.filter((l) => !aOter.has(l.cle)));
      });
      return;
    }
    sauterReconstructionRef.current = true;
    setLignes((prev) => {
      if (prev.some((l) => l.bibliothequeId === section.id && l.cle !== ligne.cle)) {
        return prev;
      }
      const idx = prev.findIndex((l) => l.cle === ligne.cle);
      if (idx < 0) return prev;
      const aOter = clesAvecDescendants(prev, ligne.cle);
      const insertAt = prev.slice(0, idx).filter((l) => !aOter.has(l.cle)).length;
      const sans = prev.filter((l) => !aOter.has(l.cle));
      const cache = new Map<string, LigneComposition>();
      const parentCle = ligne.parentCle;
      const niveau = ligne.niveau;
      const typeCode = ligne.typeCode;
      const cle = parentCle ? `ss-${section.id}` : `sec-${section.id}`;
      const racine: LigneComposition = {
        cle,
        parentCle,
        libelle: section.libelle,
        typeCode,
        niveau,
        bibliothequeId: section.id,
        montantProgramme: ligne.montantProgramme,
        estSoldeEntete: false,
      };
      const descendants = section.sous_sections.length > 0
        ? aplatirSous(section.sous_sections, typeCode, niveau + 1, cle, cache)
        : [];
      const suite = [...sans];
      suite.splice(insertAt, 0, racine, ...descendants);
      return recalculerMontantsParents(suite);
    });
  }

  async function creerDansBibliotheque(
    libelle: string,
    typeCode: "recette" | "depense",
    parentLigne: LigneComposition | null,
    remplacer?: LigneComposition,
  ) {
    const nom = libelle.trim();
    if (nom === "") return;
    const parentPourCreate = remplacer
      ? (remplacer.parentCle
        ? lignes.find((l) => l.cle === remplacer.parentCle) ?? null
        : null)
      : parentLigne;
    setCreationBiblioEnCours(true);
    try {
      const parentId = parentPourCreate?.bibliothequeId;
      if (parentPourCreate && parentPourCreate.bibliothequeId == null) {
        if (remplacer) {
          majLigne(remplacer.cle, { libelle: nom });
          return;
        }
        ajouterSousSection(parentPourCreate, nom);
        return;
      }
      if (remplacer && remplacer.niveau > 0) {
        sauterReconstructionRef.current = true;
      }
      const { section } = await creerSectionBibliotheque({
        libelle: nom,
        type: parentId ? undefined : typeCode,
        parent_id: parentId,
      });
      await chargerBibliotheque(true);
      const parentCible = parentPourCreate
        ?? (parentId
          ? lignes.find((l) => l.bibliothequeId === parentId) ?? null
          : null);
      if (remplacer) {
        remplacerLigneParSection(remplacer, section);
      } else {
        insererNoeudBibliotheque(section, parentCible);
      }
      toast.success(`« ${section.libelle} » ajoutée à la bibliothèque.`);
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : "Impossible de créer la section dans la bibliothèque.",
      );
    } finally {
      setCreationBiblioEnCours(false);
    }
  }

  function supprimerLigne(ligne: LigneComposition) {
    if (ligne.estSoldeEntete) {
      toast.error("La section Solde d'en-tête ne peut pas être supprimée.");
      return;
    }
    setLignes((prev) => {
      const aOter = clesAvecDescendants(prev, ligne.cle);
      return recalculerMontantsParents(prev.filter((l) => !aOter.has(l.cle)));
    });
    if (ligne.niveau === 0 && ligne.bibliothequeId != null) {
      setOrdreAutresIds((prev) => prev.filter((id) => id !== ligne.bibliothequeId));
    }
  }

  function deposerLigne(sourceCle: string, cibleCle: string) {
    const source = lignes.find((l) => l.cle === sourceCle);
    const cible = lignes.find((l) => l.cle === cibleCle);
    if (!source || !cible || !peutDeposerSur(source, cible)) return;

    const suivantes = reordonnerComposition(lignes, sourceCle, cibleCle);
    setLignes(suivantes);
    if (source.niveau === 0) {
      sauterReconstructionRef.current = true;
      setOrdreAutresIds(
        suivantes
          .filter((l) => l.niveau === 0 && !l.estSoldeEntete && l.bibliothequeId != null)
          .map((l) => l.bibliothequeId!),
      );
    }
    setEnDragCle(null);
    setSurvolCle(null);
  }

  async function enregistrer() {
    if (ficheExistante && !recompositionRequise) {
      setEnregistrement(true);
      try {
        const { fiche } = await programmerFicheBleue(
          ficheExistante.id,
          extraireProgrammation(lignes),
        );
        toast.success(`Fiche Bleue ${fiche.reference} enregistrée.`);
        await onCreee(fiche);
      } catch (e) {
        toast.error(
          e instanceof Error
            ? e.message
            : "Erreur lors de l'enregistrement de la Fiche Bleue.",
        );
      } finally {
        setEnregistrement(false);
      }
      return;
    }

    let payload: CreerFicheBleuePayload;

    if (modeSolde === "existante") {
      const id = Number(soldeId);
      if (!Number.isFinite(id) || id <= 0) {
        toast.error("Sélectionnez d'abord les sections (Solde obligatoire).");
        ouvrirDialog();
        return;
      }
      const idsRacines = lignes
        .filter((l) => l.niveau === 0 && !l.estSoldeEntete && l.bibliothequeId != null)
        .map((l) => l.bibliothequeId!);
      payload = {
        solde: { bibliotheque_id: id },
        autres_sections: idsRacines.map((bibliotheque_id) => ({ bibliotheque_id })),
      };
    } else {
      const libelle = (lignes.find((l) => l.cle === "solde")?.libelle
        ?? nouveauLibelleSolde).trim();
      if (libelle === "") {
        toast.error("Donnez un libellé à la section Solde.");
        return;
      }
      const sousSolde = sousSectionsDepuisLignes(lignes, "solde");
      if (sousSolde.some(function libelleVide(
        n: NouvelleSousSectionPayload,
      ): boolean {
        return n.libelle.trim() === ""
          || (n.sous_sections ?? []).some(libelleVide);
      })) {
        toast.error("Toutes les sous-sections de la Solde doivent avoir un libellé.");
        return;
      }
      const idsRacines = lignes
        .filter((l) => l.niveau === 0 && !l.estSoldeEntete && l.bibliothequeId != null)
        .map((l) => l.bibliothequeId!);
      payload = {
        solde: {
          libelle,
          sous_sections: sousSolde,
        },
        autres_sections: idsRacines.map((bibliotheque_id) => ({ bibliotheque_id })),
      };
    }

    setEnregistrement(true);
    try {
      const { fiche } = ficheExistante
        ? await modifierFicheBleue(ficheExistante.id, payload)
        : await creerFicheBleue(payload);
      let alignees = attacherIdsServeur(lignes, fiche.sections);
      let ficheFinale = fiche;
      const prog = extraireProgrammation(alignees);
      if (prog.mises_a_jour.length > 0 || prog.insertions.length > 0) {
        const majOrdre = await programmerFicheBleue(fiche.id, prog);
        ficheFinale = majOrdre.fiche;
        alignees = attacherIdsServeur(alignees, majOrdre.fiche.sections);
      }
      const montants = alignees
        .filter((l) => l.ficheSectionId != null && enfantsDirects(alignees, l.cle).length === 0)
        .map((l) => ({
          section_id: l.ficheSectionId!,
          montant_programme: normaliserMontant(l.montantProgramme),
        }));
      if (montants.length > 0) {
        const maj = await appliquerMontantsProgramme(ficheFinale.id, montants);
        ficheFinale = maj.fiche;
      }
      toast.success(
        ficheExistante
          ? `Fiche Bleue ${ficheFinale.reference} enregistrée.`
          : `Fiche Bleue ${ficheFinale.reference} créée.`,
      );
      await onCreee(ficheFinale);
    } catch (e) {
      toast.error(
        e instanceof Error
          ? e.message
          : (ficheExistante
            ? "Erreur lors de l'enregistrement de la Fiche Bleue."
            : "Erreur lors de la création de la Fiche Bleue."),
      );
    } finally {
      setEnregistrement(false);
    }
  }

  let ordreAffiche = 0;
  const recettesDispo = autresDispo.filter(
    (s) => s.type === "recette" && !estConteneurTypeSection(s.libelle, "recette", true),
  );
  const depensesDispo = autresDispo.filter(
    (s) => s.type === "depense" && !estConteneurTypeSection(s.libelle, "depense", true),
  );

  function candidatsRemplacement(ligne: LigneComposition): SectionBibliotheque[] {
    const deja = new Set(
      lignes
        .filter((l) => l.cle !== ligne.cle && l.bibliothequeId != null)
        .map((l) => l.bibliothequeId as number),
    );
    const disponibles = (s: SectionBibliotheque) => !deja.has(s.id);
    let liste: SectionBibliotheque[];
    if (ligne.niveau === 0) {
      const pool = ligne.typeCode === "depense" ? depensesDispo : recettesDispo;
      liste = pool.filter(disponibles);
    } else {
      const parent = lignes.find((l) => l.cle === ligne.parentCle);
      if (parent?.bibliothequeId == null) {
        liste = [];
      } else {
        const noeud = trouverNoeudBiblio(autresDispo, parent.bibliothequeId);
        liste = (noeud?.sous_sections ?? []).filter(disponibles);
      }
    }
    if (ligne.bibliothequeId != null) {
      const actuel = trouverNoeudBiblio(autresDispo, ligne.bibliothequeId);
      if (actuel && !liste.some((s) => s.id === actuel.id)) {
        liste = [actuel, ...liste];
      }
    }
    return liste;
  }
  const colSpanFiche = modeEdition ? 5 : 4;
  const clePremiereRecette = lignes.find((l) => l.niveau === 0 && l.typeCode === "recette")?.cle;
  const clePremiereDepense = lignes.find((l) => l.niveau === 0 && l.typeCode === "depense")?.cle;

  const boutonsActions = (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="gap-1.5"
        disabled={chargement || enregistrement}
        onClick={ouvrirDialog}
      >
        <ListChecks className="size-3.5" />
        Sélection des sections
      </Button>
      <Button
        type="button"
        size="sm"
        className="gap-1.5 text-white"
        style={{ background: theme.ctaColor }}
        disabled={chargement || enregistrement || lignes.length === 0}
        onClick={() => void enregistrer()}
      >
        {enregistrement ? <Loader2 className="size-3.5 animate-spin" /> : null}
        {ficheExistante ? "Valider les modifications" : "Créer la fiche"}
      </Button>
    </>
  );

  return (
    <div className="flex w-full flex-col gap-4">
      {masquerEnTete ? (
        conteneurActions ? createPortal(boutonsActions, conteneurActions) : null
      ) : (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-1.5"
              disabled={enregistrement}
              onClick={onAnnuler}
            >
              <ArrowLeft className="size-3.5" />
              Retour
            </Button>
            <p className="truncate text-[15px] font-bold text-foreground sm:text-[16px]">
              {ficheExistante
                ? `Modifier la Fiche Bleue ${ficheExistante.reference}`
                : `Créer la Fiche Bleue du ${dateLibelle}`}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {boutonsActions}
          </div>
        </div>
      )}

      {chargement ? (
        <div className="space-y-2 py-2">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-40 w-full" />
        </div>
      ) : (
        <div className="min-w-0">
          <div className={cn(CLASSE_BARRE_OUTILS_FB, "flex-wrap justify-between gap-2")}>
            <Label>Composition de la fiche</Label>
            {modeEdition ? (
              <div className="flex flex-wrap gap-1.5">
                <ComboboxRechercheSection
                  sections={recettesDispo}
                  placeholder="Rechercher une section recette…"
                  libelleCreer="Créer la section"
                  creationEnCours={creationBiblioEnCours}
                  onSelect={(section) => choisirSectionRecherche(section, null)}
                  onCreer={(libelle) => void creerDansBibliotheque(libelle, "recette", null)}
                  trigger={
                    <Button type="button" size="sm" variant="outline" className="gap-1">
                      <Plus className="size-3.5" />
                      Recette
                    </Button>
                  }
                />
                <ComboboxRechercheSection
                  sections={depensesDispo}
                  placeholder="Rechercher une section dépense…"
                  libelleCreer="Créer la section"
                  creationEnCours={creationBiblioEnCours}
                  onSelect={(section) => choisirSectionRecherche(section, null)}
                  onCreer={(libelle) => void creerDansBibliotheque(libelle, "depense", null)}
                  trigger={
                    <Button type="button" size="sm" variant="outline" className="gap-1">
                      <Plus className="size-3.5" />
                      Dépense
                    </Button>
                  }
                />
              </div>
            ) : null}
          </div>

          <Table containerClassName="rounded-xl border">
            <TableHeader>
              <TableRow className="bg-muted/40 hover:bg-muted/40">
                <TableHead className="w-10 bg-muted/90" />
                <TableHead className="w-14 bg-muted/90">N°</TableHead>
                <TableHead className="bg-muted/90">BANCAIRE</TableHead>
                <TableHead className="w-52 bg-muted/90 text-right">PROGRAMME (FCFA)</TableHead>
                {modeEdition ? (
                  <TableHead className="w-24 bg-muted/90 text-right">Actions</TableHead>
                ) : null}
              </TableRow>
            </TableHeader>
            <TableBody>
              {lignes.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={colSpanFiche}
                    className="py-8 text-center text-muted-foreground"
                  >
                    Aucune section. Cliquez sur « Sélection des sections » pour composer la fiche.
                  </TableCell>
                </TableRow>
              ) : (
                lignes.flatMap((ligne) => {
                  if (ligne.niveau === 0) ordreAffiche += 1;
                  const numero = ligne.niveau === 0 ? ordreAffiche : "";
                  const montantCalcule = enfantsDirects(lignes, ligne.cle).length > 0;
                  const afficherGroupe =
                    ligne.niveau === 0
                    && (ligne.typeCode === "recette" || ligne.typeCode === "depense")
                    && ligne.cle === (ligne.typeCode === "recette"
                      ? clePremiereRecette
                      : clePremiereDepense)
                    && !estConteneurTypeSection(ligne.libelle, ligne.typeCode, true);
                  const sourceDrag = enDragCle
                    ? lignes.find((l) => l.cle === enDragCle) ?? null
                    : null;
                  const deposable = sourceDrag != null && peutDeposerSur(sourceDrag, ligne);
                  const row = (
                    <TableRow
                      key={ligne.cle}
                      data-fb-racine={ligne.niveau === 0 ? ligne.typeCode : undefined}
                      data-fb-type={ligne.typeCode}
                      className={cn(
                        ligne.estSoldeEntete && "bg-primary/5",
                        enDragCle === ligne.cle && "opacity-50",
                        deposable && survolCle === ligne.cle && "bg-primary/5 ring-2 ring-inset ring-primary/40",
                      )}
                      onDragOver={(e) => {
                        if (!deposable) return;
                        e.preventDefault();
                        e.dataTransfer.dropEffect = "move";
                        setSurvolCle(ligne.cle);
                      }}
                      onDragLeave={() => {
                        if (survolCle === ligne.cle) setSurvolCle(null);
                      }}
                      onDrop={(e) => {
                        if (!deposable || enDragCle == null) return;
                        e.preventDefault();
                        deposerLigne(enDragCle, ligne.cle);
                      }}
                    >
                      <TableCell>
                        {ligne.estSoldeEntete ? (
                          <Pin className="size-3.5 text-primary" />
                        ) : modeEdition ? (
                          <span
                            draggable={!enregistrement}
                            onDragStart={(e) => {
                              e.dataTransfer.effectAllowed = "move";
                              e.dataTransfer.setData("text/plain", ligne.cle);
                              setEnDragCle(ligne.cle);
                            }}
                            onDragEnd={() => {
                              setEnDragCle(null);
                              setSurvolCle(null);
                            }}
                            className="inline-flex shrink-0 cursor-grab text-muted-foreground/70 hover:text-foreground active:cursor-grabbing"
                            title="Glisser pour réordonner"
                            aria-label="Réordonner par glisser-déposer"
                          >
                            <GripVertical className="size-3.5" />
                          </span>
                        ) : null}
                      </TableCell>
                      <TableCell className="tabular-nums text-muted-foreground">
                        {numero}
                      </TableCell>
                      <TableCell>
                        <div
                          className={cn(
                            "min-w-0",
                            ligne.niveau > 0 && "border-l-2 border-muted-foreground/25",
                          )}
                          style={styleIndentSection(ligne.niveau)}
                        >
                          {ligne.estSoldeEntete || ligne.typeCode === "solde" ? (
                            <CelluleEditable
                              valeur={ligne.libelle}
                              disabled={enregistrement}
                              className="font-medium"
                              onCommit={(libelle) => majLigne(ligne.cle, { libelle })}
                            />
                          ) : (
                            <ComboboxRechercheSection
                              sections={candidatsRemplacement(ligne)}
                              placeholder={
                                ligne.niveau === 0
                                  ? "Rechercher une section…"
                                  : "Rechercher une sous-section…"
                              }
                              libelleCreer={
                                ligne.niveau === 0
                                  ? "Créer la section"
                                  : "Créer la sous-section"
                              }
                              ouvrirSur="doubleClick"
                              align="start"
                              disabled={enregistrement}
                              creationEnCours={creationBiblioEnCours}
                              onSelect={(section) => remplacerLigneParSection(ligne, section)}
                              onCreer={(libelle) =>
                                void creerDansBibliotheque(
                                  libelle,
                                  ligne.typeCode === "depense" ? "depense" : "recette",
                                  null,
                                  ligne,
                                )
                              }
                              trigger={
                                <button
                                  type="button"
                                  disabled={enregistrement}
                                  title="Double-cliquer pour rechercher ou modifier"
                                  className={cn(
                                    "block w-full rounded-md px-1 py-0.5 text-left hover:bg-muted/60 disabled:cursor-default disabled:hover:bg-transparent font-medium",
                                    ligne.niveau > 0 && "text-muted-foreground",
                                  )}
                                >
                                  {ligne.libelle}
                                </button>
                              }
                            />
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <CelluleEditable
                          valeur={ligne.montantProgramme}
                          type="montant"
                          align="right"
                          disabled={enregistrement || montantCalcule}
                          title={
                            montantCalcule
                              ? "Calculé automatiquement (somme des sous-sections)"
                              : undefined
                          }
                          className={cn(montantCalcule && "text-muted-foreground")}
                          onCommit={(montantProgramme) =>
                            majLigne(ligne.cle, { montantProgramme })
                          }
                        />
                      </TableCell>
                      {modeEdition ? (
                        <TableCell className="text-right">
                          <div className="inline-flex gap-0.5">
                            <ComboboxRechercheSection
                              sections={
                                ligne.bibliothequeId != null
                                  ? (trouverNoeudBiblio(autresDispo, ligne.bibliothequeId)
                                      ?.sous_sections ?? [])
                                  : []
                              }
                              placeholder="Rechercher une sous-section…"
                              libelleCreer="Créer la sous-section"
                              creationEnCours={creationBiblioEnCours}
                              onSelect={(section) => choisirSectionRecherche(section, ligne)}
                              onCreer={(libelle) =>
                                void creerDansBibliotheque(
                                  libelle,
                                  ligne.typeCode === "depense" ? "depense" : "recette",
                                  ligne,
                                )
                              }
                              trigger={
                                <Button
                                  type="button"
                                  size="icon-sm"
                                  variant="ghost"
                                  title="Ajouter une sous-section"
                                >
                                  <Plus className="size-3.5" />
                                </Button>
                              }
                            />
                            {!ligne.estSoldeEntete ? (
                              <Button
                                type="button"
                                size="icon-sm"
                                variant="ghost"
                                className="text-destructive"
                                title="Supprimer"
                                onClick={() => supprimerLigne(ligne)}
                              >
                                <Trash2 className="size-3.5" />
                              </Button>
                            ) : null}
                          </div>
                        </TableCell>
                      ) : null}
                    </TableRow>
                  );
                  return afficherGroupe
                    ? [
                        <LigneGroupeType
                          key={`groupe-${ligne.typeCode}`}
                          type={ligne.typeCode === "depense" ? "depense" : "recette"}
                          colSpan={colSpanFiche}
                        />,
                        row,
                      ]
                    : [row];
                })
              )}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog open={dialogOuvert} onOpenChange={setDialogOuvert}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader className="pr-8">
            <DialogTitle>Sélection des sections</DialogTitle>
            <DialogDescription>
              Choisissez la Solde d&apos;en-tête, puis les recettes et dépenses à
              inclure dans la composition.
            </DialogDescription>
          </DialogHeader>

          <div className="max-h-[60vh] space-y-4 overflow-y-auto pr-1">
            <div className="space-y-2">
              <Label>Section Solde (obligatoire)</Label>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant={brouillonModeSolde === "existante" ? "default" : "outline"}
                  disabled={soldes.length === 0}
                  onClick={() => setBrouillonModeSolde("existante")}
                >
                  Bibliothèque
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={brouillonModeSolde === "nouvelle" ? "default" : "outline"}
                  onClick={() => {
                    setBrouillonModeSolde("nouvelle");
                    if (brouillonSousSolde.length === 0 && modeSolde === "nouvelle") {
                      setBrouillonSousSolde(lignesVersNoeudsSousSolde(lignes, "solde"));
                    }
                  }}
                >
                  Nouvelle Solde
                </Button>
              </div>
              {brouillonModeSolde === "existante" ? (
                <Select value={brouillonSoldeId} onValueChange={setBrouillonSoldeId}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Section Solde…" />
                  </SelectTrigger>
                  <SelectContent>
                    {soldes.map((s) => (
                      <SelectItem key={s.id} value={String(s.id)}>
                        {s.libelle}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <div className="space-y-3">
                  <Input
                    value={brouillonNouveauLibelle}
                    onChange={(e) => setBrouillonNouveauLibelle(e.target.value)}
                    placeholder="Ex. SOLDES BANCAIRES D'OUVERTURE"
                  />
                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <Label className="text-muted-foreground">Sous-sections</Label>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-7 gap-1"
                        onClick={() =>
                          setBrouillonSousSolde((prev) => [...prev, nouveauNoeudSousSolde()])
                        }
                      >
                        <Plus className="size-3.5" />
                        Ajouter
                      </Button>
                    </div>
                    {brouillonSousSolde.length === 0 ? (
                      <p className="rounded-lg border border-dashed px-3 py-3 text-center text-[12px] text-muted-foreground">
                        Aucune sous-section : la Solde sera créée seule. Vous pourrez
                        aussi en ajouter ensuite via « Modifier ».
                      </p>
                    ) : (
                      <div className="max-h-48 space-y-1.5 overflow-y-auto rounded-lg border p-3">
                        {brouillonSousSolde.map((noeud) => {
                          const ligneNoeud = (n: NoeudSousSolde, profondeur: number): ReactNode => (
                            <div key={n.cle} className="space-y-1.5">
                              <div className="flex items-center gap-2">
                                <CornerDownRight className="size-3.5 shrink-0 text-muted-foreground" />
                                <Input
                                  value={n.libelle}
                                  onChange={(e) =>
                                    setBrouillonSousSolde((prev) =>
                                      majNoeudSousSolde(prev, n.cle, (x) => ({
                                        ...x,
                                        libelle: e.target.value,
                                      })),
                                    )
                                  }
                                  placeholder={`Sous-section (niveau ${profondeur})`}
                                  className="h-8 text-[12.5px]"
                                />
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  className="size-8 shrink-0 text-muted-foreground"
                                  title="Ajouter une sous-sous-section"
                                  onClick={() =>
                                    setBrouillonSousSolde((prev) =>
                                      majNoeudSousSolde(prev, n.cle, (x) => ({
                                        ...x,
                                        sousSections: [...x.sousSections, nouveauNoeudSousSolde()],
                                      })),
                                    )
                                  }
                                >
                                  <Plus className="size-3.5" />
                                </Button>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  className="size-8 shrink-0 text-muted-foreground hover:text-destructive"
                                  title="Retirer"
                                  onClick={() =>
                                    setBrouillonSousSolde((prev) =>
                                      retirerNoeudSousSolde(prev, n.cle),
                                    )
                                  }
                                >
                                  <Trash2 className="size-3.5" />
                                </Button>
                              </div>
                              {n.sousSections.length > 0 ? (
                                <div className="space-y-1.5 border-l pl-4">
                                  {n.sousSections.map((enfant) =>
                                    ligneNoeud(enfant, profondeur + 1),
                                  )}
                                </div>
                              ) : null}
                            </div>
                          );
                          return ligneNoeud(noeud, 1);
                        })}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {([
              ["Recettes", recettesDispo],
              ["Dépenses", depensesDispo],
            ] as const).map(([titre, liste]) => (
              <div key={titre} className="space-y-2">
                <Label>{titre}</Label>
                {liste.length === 0 ? (
                  <p className="text-[12.5px] text-muted-foreground">
                    Aucune section {titre.toLowerCase()} en bibliothèque.
                  </p>
                ) : (
                  <div className="max-h-56 space-y-1 overflow-y-auto rounded-lg border p-2">
                    {liste.map((s) => {
                      const cochee = brouillonAutresIds.includes(s.id);
                      return (
                        <label
                          key={s.id}
                          className={cn(
                            "flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-[12.5px] hover:bg-muted/60",
                            cochee && "bg-primary/5",
                          )}
                        >
                          <Checkbox
                            checked={cochee}
                            onCheckedChange={(v) =>
                              basculerBrouillonAutre(s.id, v === true)
                            }
                          />
                          <span className="min-w-0 flex-1 truncate font-medium">
                            {s.libelle}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                )}
              </div>
            ))}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setDialogOuvert(false)}>
              Annuler
            </Button>
            <Button
              type="button"
              className="text-white"
              style={{ background: theme.ctaColor }}
              onClick={appliquerSelection}
            >
              Appliquer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

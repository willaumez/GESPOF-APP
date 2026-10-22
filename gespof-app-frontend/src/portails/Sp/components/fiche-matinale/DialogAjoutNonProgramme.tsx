import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { GripVertical, Loader2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { getPortalMenu } from "@/shared/config/menu";
import { cn } from "@/shared/lib/utils";
import { messageDonneesOuDefaut } from "@/shared/lib/message-utilisateur";
import { Button } from "@/shared/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/shared/components/ui/dialog";
import { Input } from "@/shared/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/shared/components/ui/tabs";
import {
  ajouterSectionNonProgrammee,
  modifierSectionNonProgrammee,
  reordonnerSectionsNonProgrammees,
  supprimerSectionNonProgrammee,
} from "@/portails/Sp/api/fiches-execution";
import { formaterMontantFcfa, DECALAGE_SOUS_SECTION_PX } from "@/portails/Sp/components/fiche-bleue/fiche-bleue-affichage";
import type {
  FicheExecutionDetail,
  SectionFicheExecution,
} from "@/portails/Sp/types/fiche-execution.interface";

type TypeAjout = "recette" | "depense";
type ChampEdition = "nom" | "realise";
type EditionEnCours = { id: number; champ: ChampEdition } | null;

const CLASSE_ONGLET =
  "h-8 flex-1 px-3 data-[state=inactive]:text-muted-foreground data-[state=active]:bg-white data-[state=active]:font-semibold data-[state=active]:text-[#a67a08] data-[state=active]:shadow-sm";

function normaliserNom(nom: string): string {
  return nom
    .toUpperCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");
}

function estConteneurNonProgramme(
  section: SectionFicheExecution,
  type: TypeAjout,
): boolean {
  return (
    section.type === type && normaliserNom(section.nom).includes("NON PROGRAMM")
  );
}

function trouverConteneur(
  sections: SectionFicheExecution[],
  type: TypeAjout,
): SectionFicheExecution | null {
  for (const s of sections) {
    if (estConteneurNonProgramme(s, type)) return s;
    const enfant = trouverConteneur(s.sous_sections, type);
    if (enfant) return enfant;
  }
  return null;
}

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

function trierFratrie(
  sections: SectionFicheExecution[],
): SectionFicheExecution[] {
  return [...sections].sort((a, b) => a.ordre - b.ordre || a.id - b.id);
}

interface DialogAjoutNonProgrammeProps {
  fiche: FicheExecutionDetail | null;
  ouvert: boolean;
  onClose: () => void;
  onAjoutee: (fiche: FicheExecutionDetail) => void;
}

/**
 * Gestion des recettes / dépenses hors Fiche Bleue : onglets, arbre,
 * ajout, double-clic pour modifier, suppression et glisser-déposer.
 */
export function DialogAjoutNonProgramme({
  fiche,
  ouvert,
  onClose,
  onAjoutee,
}: DialogAjoutNonProgrammeProps) {
  const theme = getPortalMenu("sp").theme;
  const [onglet, setOnglet] = useState<TypeAjout>("depense");
  const [brouillon, setBrouillon] = useState("");
  const [parentCible, setParentCible] = useState<number | null>(null);
  const [enregistrement, setEnregistrement] = useState(false);
  const [glisseId, setGlisseId] = useState<number | null>(null);
  const [survolId, setSurvolId] = useState<number | null>(null);
  const [edition, setEdition] = useState<EditionEnCours>(null);

  useEffect(() => {
    if (!ouvert) return;
    setOnglet("depense");
    setBrouillon("");
    setParentCible(null);
    setEnregistrement(false);
    setGlisseId(null);
    setSurvolId(null);
    setEdition(null);
  }, [ouvert]);

  const conteneur = useMemo(
    () => (fiche ? trouverConteneur(fiche.sections, onglet) : null),
    [fiche, onglet],
  );
  const items = useMemo(
    () => (conteneur ? trierFratrie(conteneur.sous_sections) : []),
    [conteneur],
  );

  const titreConteneur =
    onglet === "depense"
      ? (conteneur?.nom ?? "Dépenses non programmées")
      : (conteneur?.nom ?? "Recettes non programmées");

  async function appliquer(
    action: () => Promise<{ fiche: FicheExecutionDetail }>,
    succes?: string,
  ) {
    if (!fiche) return;
    setEnregistrement(true);
    try {
      const { fiche: maj } = await action();
      onAjoutee(maj);
      if (succes) toast.success(succes);
    } catch (e) {
      toast.error(
        messageDonneesOuDefaut(
          e instanceof Error ? e.message : null,
          "Impossible de mettre à jour les rubriques.",
        ),
      );
    } finally {
      setEnregistrement(false);
    }
  }

  async function ajouter(parentId?: number | null) {
    if (!fiche) return;
    const nom = brouillon.trim();
    if (nom === "") {
      toast.error("Donnez un libellé à la rubrique.");
      return;
    }
    await appliquer(
      () =>
        ajouterSectionNonProgrammee(fiche.id, {
          nom,
          type: onglet,
          parent_id: parentId ?? parentCible,
        }),
      "Rubrique non programmée ajoutée.",
    );
    setBrouillon("");
  }

  const nomParentCible = useMemo(() => {
    if (parentCible == null || !conteneur) return null;
    function chercher(liste: SectionFicheExecution[]): string | null {
      for (const s of liste) {
        if (s.id === parentCible) return s.nom;
        const enfant = chercher(s.sous_sections);
        if (enfant) return enfant;
      }
      return null;
    }
    return chercher(conteneur.sous_sections);
  }, [parentCible, conteneur]);

  async function modifier(
    sectionId: number,
    payload: { nom?: string; montant_realise?: string },
  ) {
    if (!fiche) return;
    await appliquer(() =>
      modifierSectionNonProgrammee(fiche.id, sectionId, payload),
    );
    setEdition(null);
  }

  async function supprimer(sectionId: number) {
    if (!fiche) return;
    await appliquer(
      () => supprimerSectionNonProgrammee(fiche.id, sectionId),
      "Rubrique supprimée.",
    );
  }

  async function reordonner(
    fratrie: SectionFicheExecution[],
    deplaceId: number,
    cibleId: number,
  ) {
    if (!fiche || deplaceId === cibleId) return;
    const ids = fratrie.map((s) => s.id);
    const from = ids.indexOf(deplaceId);
    const to = ids.indexOf(cibleId);
    if (from < 0 || to < 0) return;
    const suivant = [...ids];
    const [extrait] = suivant.splice(from, 1);
    suivant.splice(to, 0, extrait);
    await appliquer(
      () => reordonnerSectionsNonProgrammees(fiche.id, suivant),
      "Ordre mis à jour.",
    );
  }

  return (
    <Dialog
      open={ouvert}
      onOpenChange={(o) => {
        if (!o) onClose();
      }}
    >
      <DialogContent className="flex max-h-[calc(100dvh-2rem)] w-[min(96vw,72rem)] flex-col gap-4 sm:max-w-5xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Plus className="size-4" style={{ color: theme.iconColor }} />
            Rubriques non programmées
          </DialogTitle>
          <DialogDescription>
            Éléments présents en fiche d&apos;exécution mais absents de la Fiche
            Bleue. Ils sont rangés sous « Dépenses non programmées » ou «
            Recettes non programmées ». Double-cliquez un libellé ou un réalisé
            pour le modifier.
          </DialogDescription>
        </DialogHeader>

        <Tabs
          value={onglet}
          onValueChange={(v) => {
            setOnglet(v as TypeAjout);
            setParentCible(null);
          }}
        >
          <TabsList className="h-9 w-full border border-border/70 bg-muted/90">
            <TabsTrigger value="depense" className={CLASSE_ONGLET}>
              Dépenses
            </TabsTrigger>
            <TabsTrigger value="recette" className={CLASSE_ONGLET}>
              Recettes
            </TabsTrigger>
          </TabsList>
        </Tabs>

        <p className="text-[12px] font-semibold uppercase tracking-wide text-muted-foreground">
          {titreConteneur}
        </p>
        {nomParentCible ? (
          <p className="text-[12px] text-[#a67a08]">
            Sous-rubrique de « {nomParentCible} »
          </p>
        ) : null}

        <div className="min-h-[280px] min-w-0 flex-1 overflow-auto rounded-lg border bg-muted/20">
          {items.length === 0 ? (
            <p className="px-2 py-12 text-center text-[13px] text-muted-foreground">
              Aucune rubrique non programmée. Ajoutez-en ci-dessous.
            </p>
          ) : (
            <table className="w-full caption-bottom text-sm">
              <thead className="sticky top-0 z-10 bg-muted/90">
                <tr className="border-b text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                  <th className="px-2 py-2 text-left font-bold">Rubrique</th>
                  <th className="w-36 px-2 py-2 text-right font-bold">Programme</th>
                  <th className="w-36 px-2 py-2 text-right font-bold">Réalisé</th>
                  <th className="w-36 px-2 py-2 text-right font-bold">Écart</th>
                  <th className="w-20 px-2 py-2 text-right font-bold">Actions</th>
                </tr>
              </thead>
              <tbody>
                <ListeRubriques
                  sections={items}
                  niveau={0}
                  disabled={enregistrement}
                  glisseId={glisseId}
                  survolId={survolId}
                  parentCible={parentCible}
                  edition={edition}
                  onGlisse={setGlisseId}
                  onSurvol={setSurvolId}
                  onDeposer={(fratrie, deplace, cible) => {
                    void reordonner(fratrie, deplace, cible);
                    setGlisseId(null);
                    setSurvolId(null);
                  }}
                  onAjouterEnfant={(id) => {
                    setParentCible(id);
                  }}
                  onSupprimer={(id) => void supprimer(id)}
                  onDemarrerEdition={(id, champ) =>
                    setEdition({ id, champ })
                  }
                  onAnnulerEdition={() => setEdition(null)}
                  onCommitNom={(id, nom, actuel) => {
                    if (nom === actuel) {
                      setEdition(null);
                      return;
                    }
                    void modifier(id, { nom });
                  }}
                  onCommitRealise={(id, montant, actuel) => {
                    if (montant === normaliserMontant(actuel)) {
                      setEdition(null);
                      return;
                    }
                    void modifier(id, { montant_realise: montant });
                  }}
                />
              </tbody>
            </table>
          )}
        </div>

        <form
          className="flex flex-col gap-2 sm:flex-row sm:items-center"
          onSubmit={(e) => {
            e.preventDefault();
            void ajouter(parentCible);
          }}
        >
          <Input
            value={brouillon}
            onChange={(e) => setBrouillon(e.target.value)}
            placeholder={
              parentCible != null
                ? "Libellé de la sous-rubrique…"
                : onglet === "depense"
                  ? "Ex. Dépense imprévue"
                  : "Ex. Recette exceptionnelle"
            }
            disabled={enregistrement || !fiche}
          />
          <div className="flex shrink-0 gap-2">
            {parentCible != null ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={enregistrement}
                onClick={() => setParentCible(null)}
              >
                Annuler
              </Button>
            ) : null}
            <Button
              type="submit"
              size="sm"
              className="gap-1.5 text-white"
              disabled={enregistrement || !fiche}
              style={{ background: theme.ctaColor }}
            >
              {enregistrement && <Loader2 className="size-3.5 animate-spin" />}
              <Plus className="size-3.5" />
              {parentCible != null ? "Ajouter la sous-rubrique" : "Ajouter"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

interface PropsListeRubriques {
  sections: SectionFicheExecution[];
  niveau: number;
  disabled: boolean;
  glisseId: number | null;
  survolId: number | null;
  parentCible: number | null;
  edition: EditionEnCours;
  onGlisse: (id: number | null) => void;
  onSurvol: (id: number | null) => void;
  onDeposer: (
    fratrie: SectionFicheExecution[],
    deplaceId: number,
    cibleId: number,
  ) => void;
  onAjouterEnfant: (id: number) => void;
  onSupprimer: (id: number) => void;
  onDemarrerEdition: (id: number, champ: ChampEdition) => void;
  onAnnulerEdition: () => void;
  onCommitNom: (id: number, nom: string, actuel: string) => void;
  onCommitRealise: (id: number, montant: string, actuel: string) => void;
}

function ListeRubriques({
  sections,
  niveau,
  disabled,
  glisseId,
  survolId,
  parentCible,
  edition,
  onGlisse,
  onSurvol,
  onDeposer,
  onAjouterEnfant,
  onSupprimer,
  onDemarrerEdition,
  onAnnulerEdition,
  onCommitNom,
  onCommitRealise,
}: PropsListeRubriques) {
  const fratrie = trierFratrie(sections);

  return (
    <>
      {fratrie.map((section) => {
        const enfants = trierFratrie(section.sous_sections);
        const estFeuille = enfants.length === 0;
        const glisse = glisseId === section.id;
        const survol =
          survolId === section.id &&
          glisseId != null &&
          glisseId !== section.id;
        const enEdition = edition?.id === section.id;
        return (
          <Fragment key={section.id}>
            <tr
              onDragOver={(e) => {
                e.preventDefault();
                onSurvol(section.id);
              }}
              onDrop={(e) => {
                e.preventDefault();
                if (glisseId != null) onDeposer(fratrie, glisseId, section.id);
              }}
              className={cn(
                "border-b bg-background last:border-0",
                glisse && "opacity-50",
                survol && "bg-[#c9960a]/10",
                parentCible === section.id && "bg-[#c9960a]/8",
              )}
            >
              <td className="px-2 py-1.5">
                <div
                  className="flex min-w-0 items-center gap-1.5"
                  style={{ paddingLeft: niveau * DECALAGE_SOUS_SECTION_PX }}
                >
                  <span
                    draggable={!disabled && !enEdition}
                    onDragStart={(e) => {
                      e.dataTransfer.effectAllowed = "move";
                      e.dataTransfer.setData("text/plain", String(section.id));
                      onGlisse(section.id);
                    }}
                    onDragEnd={() => {
                      onGlisse(null);
                      onSurvol(null);
                    }}
                    className="inline-flex shrink-0"
                    title="Glisser pour réordonner"
                  >
                    <GripVertical className="size-3.5 cursor-grab text-muted-foreground active:cursor-grabbing" />
                  </span>
                  <CelluleLibelle
                    nom={section.nom}
                    edition={enEdition && edition?.champ === "nom"}
                    disabled={disabled}
                    onDemarrerEdition={() =>
                      onDemarrerEdition(section.id, "nom")
                    }
                    onAnnuler={onAnnulerEdition}
                    onCommit={(nom) =>
                      onCommitNom(section.id, nom, section.nom)
                    }
                  />
                </div>
              </td>
              <td className="px-2 py-1.5 text-right tabular-nums text-muted-foreground">
                {formaterMontantFcfa(section.montant_programme)}
              </td>
              <td className="px-2 py-1.5 text-right font-medium tabular-nums">
                <CelluleRealise
                  valeur={section.montant_realise}
                  edition={enEdition && edition?.champ === "realise"}
                  disabled={disabled || !estFeuille}
                  onDemarrerEdition={() =>
                    onDemarrerEdition(section.id, "realise")
                  }
                  onAnnuler={onAnnulerEdition}
                  onCommit={(montant) =>
                    onCommitRealise(
                      section.id,
                      montant,
                      section.montant_realise,
                    )
                  }
                />
              </td>
              <td
                className={cn(
                  "px-2 py-1.5 text-right tabular-nums",
                  estNegatif(section.montant_ecart)
                    ? "font-medium text-red-600"
                    : "text-muted-foreground",
                )}
              >
                {formaterMontantFcfa(section.montant_ecart)}
              </td>
              <td className="px-2 py-1.5">
                <div className="flex justify-end gap-0.5">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    title="Ajouter une sous-rubrique"
                    disabled={disabled}
                    onClick={() => onAjouterEnfant(section.id)}
                  >
                    <Plus className="size-3.5" />
                  </Button>
                  {section.non_programme ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      title="Supprimer"
                      disabled={disabled}
                      onClick={() => onSupprimer(section.id)}
                    >
                      <Trash2 className="size-3.5 text-destructive" />
                    </Button>
                  ) : null}
                </div>
              </td>
            </tr>
            {enfants.length > 0 ? (
              <ListeRubriques
                sections={enfants}
                niveau={niveau + 1}
                disabled={disabled}
                glisseId={glisseId}
                survolId={survolId}
                parentCible={parentCible}
                edition={edition}
                onGlisse={onGlisse}
                onSurvol={onSurvol}
                onDeposer={onDeposer}
                onAjouterEnfant={onAjouterEnfant}
                onSupprimer={onSupprimer}
                onDemarrerEdition={onDemarrerEdition}
                onAnnulerEdition={onAnnulerEdition}
                onCommitNom={onCommitNom}
                onCommitRealise={onCommitRealise}
              />
            ) : null}
          </Fragment>
        );
      })}
    </>
  );
}

function CelluleLibelle({
  nom,
  edition,
  disabled,
  onDemarrerEdition,
  onCommit,
  onAnnuler,
}: {
  nom: string;
  edition: boolean;
  disabled: boolean;
  onDemarrerEdition: () => void;
  onCommit: (nom: string) => void;
  onAnnuler: () => void;
}) {
  const [brouillon, setBrouillon] = useState(nom);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!edition) setBrouillon(nom);
  }, [nom, edition]);

  useEffect(() => {
    if (!edition) return;
    const el = inputRef.current;
    if (!el) return;
    el.focus();
    el.select();
  }, [edition]);

  function valider() {
    const trim = brouillon.trim();
    if (trim === "") {
      setBrouillon(nom);
      onAnnuler();
      return;
    }
    onCommit(trim);
  }

  if (edition && !disabled) {
    return (
      <Input
        ref={inputRef}
        value={brouillon}
        onChange={(e) => setBrouillon(e.target.value)}
        onBlur={valider}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            valider();
          }
          if (e.key === "Escape") {
            setBrouillon(nom);
            onAnnuler();
          }
        }}
        onClick={(e) => e.stopPropagation()}
        className="h-7 min-w-0 flex-1 text-[13px]"
        aria-label="Libellé de la rubrique"
      />
    );
  }

  return (
    <span
      className={cn(
        "min-w-0 truncate rounded-md px-1 py-0.5 text-[13px] font-medium",
        !disabled && "cursor-text hover:bg-muted/80",
      )}
      title={disabled ? undefined : "Double-cliquer pour modifier le libellé"}
      onDoubleClick={(e) => {
        if (disabled) return;
        e.stopPropagation();
        onDemarrerEdition();
      }}
    >
      {nom}
    </span>
  );
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
        className="ml-auto h-7 w-28 text-right tabular-nums"
        aria-label="Montant réalisé"
      />
    );
  }

  return (
    <span
      className={cn(
        "inline-block min-w-[7rem] rounded-md px-1 py-0.5 text-right font-medium tabular-nums",
        !disabled && "cursor-text hover:bg-muted/80",
      )}
      title={
        disabled
          ? "Montant calculé à partir des sous-sections"
          : "Double-cliquer pour modifier le réalisé"
      }
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

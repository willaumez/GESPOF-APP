import { useEffect, useRef, useState } from "react";
import { FileText, Inbox, Loader2 } from "lucide-react";
import { Input } from "@/shared/components/ui/input";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/shared/components/ui/table";
import { cn } from "@/shared/lib/utils";
import { formaterMontantFcfa, estConteneurTypeSection, styleIndentSection } from "@/portails/Sp/components/fiche-bleue/fiche-bleue-affichage";
import { LigneGroupeType } from "@/portails/Sp/components/fiche-bleue/LigneGroupeType";
import type { FicheBleueDetail, SectionFicheBleue } from "@/portails/Sp/types/fiche-bleue.interface";
import type { TypeSectionBibliotheque } from "@/portails/Sp/types/bibliotheque.interface";

interface LigneFicheBleue {
  id: number;
  nom: string;
  niveau: number;
  montantProgramme: string;
  estRacine: boolean;
  /** Sans sous-sections : seul niveau où le programmé se saisit (les parents sont calculés). */
  estFeuille: boolean;
  type: TypeSectionBibliotheque;
}

function aplatirSections(sections: SectionFicheBleue[], niveau = 0): LigneFicheBleue[] {
  const out: LigneFicheBleue[] = [];
  for (const s of sections) {
    out.push({
      id: s.id,
      nom: s.nom,
      niveau,
      montantProgramme: s.montant_programme,
      estRacine: niveau === 0,
      estFeuille: s.sous_sections.length === 0,
      type: s.type,
    });
    if (s.sous_sections.length > 0) {
      out.push(...aplatirSections(s.sous_sections, niveau + 1));
    }
  }
  return out;
}

function normaliserMontant(brut: string): string | null {
  const n = Number(brut.replace(/\s/g, "").replace(",", "."));
  if (!Number.isFinite(n) || n < 0) return null;
  return n.toFixed(2);
}

/** Programmé saisissable : double-clic pour éditer, Entrée pour valider, Échap pour annuler. */
function CelluleProgramme({
  valeur,
  enregistrement,
  onValider,
}: {
  valeur: string;
  enregistrement: boolean;
  onValider: (montant: string) => Promise<boolean>;
}) {
  const [edition, setEdition] = useState(false);
  const [brouillon, setBrouillon] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!edition) return;
    inputRef.current?.focus();
    inputRef.current?.select();
  }, [edition]);

  async function valider() {
    const montant = normaliserMontant(brouillon === "" ? "0" : brouillon);
    if (montant === null) {
      inputRef.current?.focus();
      return;
    }
    if (montant === normaliserMontant(valeur)) {
      setEdition(false);
      return;
    }
    if (await onValider(montant)) setEdition(false);
  }

  if (enregistrement) {
    return <Loader2 className="ml-auto size-4 animate-spin text-muted-foreground" />;
  }

  if (edition) {
    return (
      <Input
        ref={inputRef}
        value={brouillon}
        inputMode="decimal"
        onChange={(e) => setBrouillon(e.target.value)}
        onBlur={() => void valider()}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            void valider();
          }
          if (e.key === "Escape") setEdition(false);
        }}
        className="ml-auto h-7 w-40 text-right tabular-nums"
        aria-label="Montant programmé"
      />
    );
  }

  return (
    <button
      type="button"
      className="ml-auto inline-block min-w-[9rem] cursor-text rounded-md px-1.5 py-0.5 text-right font-semibold tabular-nums hover:bg-primary/10 focus-visible:bg-primary/10 focus-visible:outline-none"
      title="Double-cliquer pour modifier le programmé"
      onDoubleClick={() => {
        const n = Number(valeur.replace(",", "."));
        setBrouillon(Number.isFinite(n) && n !== 0 ? String(n) : "");
        setEdition(true);
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === "F2") {
          e.preventDefault();
          const n = Number(valeur.replace(",", "."));
          setBrouillon(Number.isFinite(n) && n !== 0 ? String(n) : "");
          setEdition(true);
        }
      }}
    >
      {formaterMontantFcfa(valeur)}
    </button>
  );
}

export function TableauLectureFicheBleue({
  fiche,
  chargement,
  onModifierProgramme,
}: {
  fiche: FicheBleueDetail | null;
  chargement: boolean;
  /**
   * Rend le programmé des rubriques feuilles saisissable (double-clic).
   * Résout `true` si l'enregistrement a réussi. Absent : lecture seule.
   */
  onModifierProgramme?: (sectionId: number, montant: string) => Promise<boolean>;
}) {
  const [sectionEnCours, setSectionEnCours] = useState<number | null>(null);
  const lignes = fiche ? aplatirSections(fiche.sections) : [];
  let ordreRacine = 0;
  const idPremiereRecette = lignes.find((l) => l.estRacine && l.type === "recette")?.id;
  const idPremiereDepense = lignes.find((l) => l.estRacine && l.type === "depense")?.id;

  if (chargement && !fiche) {
    return (
      <div className="flex min-h-44 items-center justify-center rounded-xl border text-muted-foreground">
        <div className="flex items-center gap-2 text-[13px]">
          <Loader2 className="size-5 animate-spin" />
          Chargement de la Fiche Bleue…
        </div>
      </div>
    );
  }

  if (!fiche) {
    return (
      <div
        className="flex min-h-44 flex-col items-center justify-center gap-2 rounded-xl border border-dashed px-4 text-center"
        role="status"
      >
        <FileText className="size-5 text-muted-foreground" aria-hidden />
        <p className="text-[13px] text-muted-foreground">Aucune Fiche Bleue à afficher.</p>
      </div>
    );
  }

  return (
    <Table containerClassName="rounded-xl border-2 border-green-600/55">
      <TableHeader>
        <TableRow className="hover:bg-transparent">
          <TableHead className="w-12 bg-muted">N°</TableHead>
          <TableHead className="bg-muted">BANCAIRE</TableHead>
          <TableHead className="w-44 bg-muted text-right">PROGRAMME (FCFA)</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {lignes.length === 0 ? (
          <TableRow>
            <TableCell colSpan={3} className="py-10 text-center text-muted-foreground">
              <span className="inline-flex flex-col items-center gap-1.5">
                <Inbox className="size-5" aria-hidden />
                <span className="text-[13px]">Aucune section sur cette fiche.</span>
              </span>
            </TableCell>
          </TableRow>
        ) : (
          lignes.flatMap((ligne) => {
            if (ligne.estRacine) ordreRacine += 1;
            const afficherGroupe =
              ligne.estRacine
              && (ligne.type === "recette" || ligne.type === "depense")
              && ligne.id === (ligne.type === "recette" ? idPremiereRecette : idPremiereDepense)
              && !estConteneurTypeSection(ligne.nom, ligne.type, true);
            const row = (
              <TableRow key={ligne.id}>
                <TableCell className="tabular-nums text-muted-foreground">
                  {ligne.estRacine ? ordreRacine : ""}
                </TableCell>
                <TableCell className="whitespace-normal">
                  <div
                    className={cn(
                      "min-w-0 font-medium",
                      ligne.niveau > 0 && "border-l-2 border-muted-foreground/25 text-muted-foreground",
                    )}
                    style={styleIndentSection(ligne.niveau)}
                  >
                    {ligne.nom}
                  </div>
                </TableCell>
                <TableCell className="text-right font-semibold tabular-nums">
                  {onModifierProgramme && ligne.estFeuille ? (
                    <CelluleProgramme
                      valeur={ligne.montantProgramme}
                      enregistrement={sectionEnCours === ligne.id}
                      onValider={async (montant) => {
                        setSectionEnCours(ligne.id);
                        try {
                          return await onModifierProgramme(ligne.id, montant);
                        } finally {
                          setSectionEnCours(null);
                        }
                      }}
                    />
                  ) : (
                    <span
                      title={onModifierProgramme && !ligne.estFeuille ? "Montant calculé à partir des sous-sections" : undefined}
                    >
                      {formaterMontantFcfa(ligne.montantProgramme)}
                    </span>
                  )}
                </TableCell>
              </TableRow>
            );
            return afficherGroupe
              ? [
                  <LigneGroupeType
                    key={`groupe-${ligne.type}`}
                    type={ligne.type}
                    colSpan={3}
                  />,
                  row,
                ]
              : [row];
          })
        )}
      </TableBody>
    </Table>
  );
}

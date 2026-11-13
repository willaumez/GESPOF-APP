import { useEffect, useRef, useState } from "react";
import { FileText, Inbox, Loader2 } from "lucide-react";
import { Input } from "@/shared/components/ui/input";
import { formaterMontantFcfa } from "@/portails/Sp/components/fiche-bleue/fiche-bleue-affichage";
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

const GRILLE = "minmax(0, 1fr) 200px";

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

  function demarrerEdition() {
    const n = Number(valeur.replace(",", "."));
    setBrouillon(Number.isFinite(n) && n !== 0 ? String(n) : "");
    setEdition(true);
  }

  if (enregistrement) {
    return <Loader2 className="ml-auto size-4 animate-spin text-[#64748b]" />;
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
        className="ml-auto h-7 w-full max-w-[180px] text-right tabular-nums"
        aria-label="Montant programmé"
      />
    );
  }

  return (
    <button
      type="button"
      className="w-full cursor-text rounded-md px-1 py-0.5 text-right tabular-nums hover:bg-[#f8fafc] focus-visible:outline-none"
      title="Double-cliquer pour modifier le programmé"
      onDoubleClick={demarrerEdition}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === "F2") {
          e.preventDefault();
          demarrerEdition();
        }
      }}
    >
      {formaterMontantFcfa(valeur)}
    </button>
  );
}

/**
 * Lecture / édition légère de la Fiche Bleue — présentation maquette Prototype v2
 * (Section / rubrique · Programmé), avec double-clic sur les feuilles.
 */
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

  if (chargement && !fiche) {
    return (
      <div className="flex min-h-44 items-center justify-center text-[#64748b]">
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
        className="flex min-h-44 flex-col items-center justify-center gap-2 px-4 text-center"
        role="status"
      >
        <FileText className="size-5 text-[#64748b]" aria-hidden />
        <p className="text-[13px] text-[#64748b]">Aucune Fiche Bleue à afficher.</p>
      </div>
    );
  }

  return (
    <div>
      <div
        className="grid items-center border-b border-[#e2e8f0] bg-[#f8fafc] text-[11.5px] font-semibold uppercase tracking-[0.06em] text-[#64748b]"
        style={{
          gridTemplateColumns: GRILLE,
          gap: 12,
          padding: "9px 18px",
        }}
      >
        <span>Section / rubrique</span>
        <span className="text-right">Programmé</span>
      </div>

      {lignes.length === 0 ? (
        <div className="flex flex-col items-center gap-1.5 py-10 text-[#64748b]">
          <Inbox className="size-5" aria-hidden />
          <span className="text-[13px]">Aucune section sur cette fiche.</span>
        </div>
      ) : (
        lignes.map((ligne) => {
          if (ligne.estRacine) {
            return (
              <div
                key={ligne.id}
                className="grid items-center border-y border-[#dbe6f3] text-[12.5px] font-semibold uppercase tracking-[0.06em] text-[#1e3a8a]"
                style={{
                  gridTemplateColumns: GRILLE,
                  gap: 12,
                  minHeight: 38,
                  padding: "0 18px",
                  background: "#eef4fb",
                }}
              >
                <span>{ligne.nom}</span>
                <span className="text-right tabular-nums tracking-normal">
                  {formaterMontantFcfa(ligne.montantProgramme)}
                </span>
              </div>
            );
          }

          return (
            <div
              key={ligne.id}
              className="grid items-center border-b border-[#f1f5f9] text-[14px] text-[#0f172a]"
              style={{
                gridTemplateColumns: GRILLE,
                gap: 12,
                minHeight: 40,
                padding: "0 18px 0 30px",
              }}
            >
              <span>{ligne.nom}</span>
              <span className="text-right">
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
                    className="tabular-nums"
                    title={
                      onModifierProgramme && !ligne.estFeuille
                        ? "Montant calculé à partir des sous-sections"
                        : undefined
                    }
                  >
                    {formaterMontantFcfa(ligne.montantProgramme)}
                  </span>
                )}
              </span>
            </div>
          );
        })
      )}
    </div>
  );
}

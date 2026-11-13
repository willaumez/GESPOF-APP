// Modèle cible : prevision_recette (source DGI|DGH|DGDDI, code, mois, FCFA) ;
// DGI/DGH saisis en millions (×1e6 à l'import), DGDDI en FCFA ; arborescence Prévisions.xlsm.
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  SofGrilleMensuellePage,
  type LigneGrilleMensuelle,
} from "@/portails/Sof/components/SofGrilleMensuellePage";
import {
  enregistrerGrille,
  obtenirGrille,
} from "@/portails/Sof/api/parametrage";
import type { TypeGrilleSof } from "@/portails/Sof/types/parametrage.interface";
import { useExerciceAnneeCourante } from "@/portails/Sof/hooks/useExerciceAnneeCourante";
import {
  grilleApiVersLignes,
  lignesVersApi,
  modeleVersLignes,
} from "@/portails/Sof/lib/grille-mensuelle";

type Regie = "DGI" | "DGH" | "DGDDI";

const TYPE_PAR_REGIE: Record<Regie, TypeGrilleSof> = {
  DGI: "PLAN_DGI",
  DGH: "PLAN_DGH",
  DGDDI: "PLAN_DGDDI",
};

const LIGNES: Record<
  Regie,
  { id: string; libelle: string; niveau?: number }[]
> = {
  DGI: [
    { id: "a", libelle: "A. Taxes sur biens et services", niveau: 0 },
    { id: "a1", libelle: "T.V.A." },
    { id: "a2", libelle: "Autres taxes / biens serv." },
    { id: "a3", libelle: "Taxes sur les jeux" },
    { id: "a4", libelle: "Sur les loyers" },
    { id: "a5", libelle: "Droits d'accises" },
    { id: "a6", libelle: "Autres taxes" },
    { id: "a7", libelle: "Redevance audiovisuelle" },
    { id: "a8", libelle: "Contribution spéciale de solidarité" },
    { id: "a9", libelle: "Taxe sur les carburants" },
    { id: "a10", libelle: "Taxe sur les transferts de fonds" },
    { id: "a11", libelle: "Redevance d'usure de la route" },
    { id: "a12", libelle: "Taxe sur les retraits" },
    { id: "a13", libelle: "Taxe des lotisseurs" },
    { id: "b", libelle: "B. Impôts sur les personnes", niveau: 0 },
    { id: "b1", libelle: "IRPP" },
    { id: "b2", libelle: "IRPP prélèvement employeur" },
    { id: "b3", libelle: "I.F.R." },
    { id: "b4", libelle: "Taxe complémentaire" },
    { id: "b5", libelle: "Autres" },
    { id: "c", libelle: "C. Impôts sur les sociétés H.P.", niveau: 0 },
    { id: "c1", libelle: "IS normal" },
    { id: "c2", libelle: "IS mines" },
    { id: "c3", libelle: "Retenue à la source" },
    { id: "d", libelle: "D. Autres recettes fiscales", niveau: 0 },
    { id: "d1", libelle: "Enregistrement" },
    { id: "d2", libelle: "IRVM" },
    { id: "d3", libelle: "Pénalités" },
    { id: "d4", libelle: "Taxe de superficie" },
    { id: "d5", libelle: "Autres taxes" },
    { id: "e", libelle: "E. Recettes non fiscales", niveau: 0 },
    { id: "e1", libelle: "Produits des participations" },
    { id: "e2", libelle: "Domaine minier" },
    { id: "e3", libelle: "Domaine forestier" },
    { id: "e4", libelle: "Domaine foncier" },
    { id: "e5", libelle: "Recettes diverses" },
    { id: "f", libelle: "F. Recettes affectées", niveau: 0 },
    { id: "f1", libelle: "Patentes" },
    { id: "f2", libelle: "ISL" },
    { id: "f3", libelle: "Licences" },
  ],
  DGH: [
    { id: "g1", libelle: "Redevance superficiaire" },
    { id: "g2", libelle: "Redevance minière proportionnelle brute" },
    { id: "g3", libelle: "Redevance minière proportionnelle (gaz)" },
    { id: "g4", libelle: "Impôts sur les sociétés" },
    { id: "g5", libelle: "Autres recettes" },
    { id: "g6", libelle: "Profit oil" },
    { id: "g7", libelle: "Ventes État gaz" },
    { id: "g8", libelle: "Dividendes" },
    { id: "g9", libelle: "Discounts" },
    { id: "g10", libelle: "Vente État SOGARA" },
    { id: "g11", libelle: "Bonis et paiements exceptionnels" },
    { id: "g12", libelle: "Autres recettes" },
  ],
  DGDDI: [
    { id: "x", libelle: "Droits et taxes à l'exportation", niveau: 0 },
    { id: "x1", libelle: "Droit de sortie / mines" },
    { id: "x2", libelle: "Taxe d'abattage / bois sciés et ouvrages" },
    { id: "x3", libelle: "Timbre douanier" },
    { id: "x4", libelle: "Taxe sur les produits minéraux" },
    { id: "y", libelle: "Droits et taxes à l'importation", niveau: 0 },
    { id: "y1", libelle: "Droit de douane" },
    { id: "y2", libelle: "TVA" },
    { id: "y3", libelle: "Droit d'accise" },
    { id: "y4", libelle: "Intérêt de crédit" },
    { id: "y5", libelle: "Surtaxe temporaire" },
    { id: "y6", libelle: "Précompte IRPP" },
    { id: "y7", libelle: "Taxe communautaire d'intégration" },
    { id: "y8", libelle: "Contribution communautaire d'intégration" },
    { id: "y9", libelle: "Prélèvement OHADA" },
    { id: "y10", libelle: "Contribution spéciale solidarité" },
    { id: "y11", libelle: "Contribution au financement de l'U.A." },
    { id: "y12", libelle: "Redevance informatique" },
    { id: "y13", libelle: "Contentieux (amendes)" },
    { id: "y14", libelle: "Magasinage" },
    { id: "y15", libelle: "Travail extra-légal" },
    { id: "y16", libelle: "Contrôles spécifiques" },
    { id: "y17", libelle: "Vente aux enchères" },
    { id: "y18", libelle: "CNAMGS CSS" },
    { id: "y19", libelle: "RA cotisation internationale" },
  ],
};

const UNITES: Record<Regie, string> = {
  DGI: "millions de FCFA (affichage) · stockage FCFA",
  DGH: "millions de FCFA (affichage) · stockage FCFA",
  DGDDI: "FCFA",
};

const REF_2025: Record<Regie, string> = {
  DGI: "985 020 M",
  DGH: "643 712,5 M",
  DGDDI: "479 334 904 226 FCFA",
};

export default function Page() {
  const { annee, chargement: chargementEx } = useExerciceAnneeCourante();
  const [regie, setRegie] = useState<Regie>("DGI");
  const [lignes, setLignes] = useState<LigneGrilleMensuelle[]>([]);
  const [chargement, setChargement] = useState(false);
  const [enCours, setEnCours] = useState(false);

  const modele = useMemo(() => modeleVersLignes(LIGNES[regie]), [regie]);

  const charger = useCallback(
    async (ex: number, r: Regie) => {
      setChargement(true);
      try {
        const res = await obtenirGrille(ex, TYPE_PAR_REGIE[r]);
        if (res.grille.lignes.length > 0) {
          setLignes(grilleApiVersLignes(res.grille));
        } else {
          setLignes(modeleVersLignes(LIGNES[r]));
        }
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Chargement impossible.");
        setLignes(modeleVersLignes(LIGNES[r]));
      } finally {
        setChargement(false);
      }
    },
    [],
  );

  useEffect(() => {
    if (annee == null) return;
    void charger(annee, regie);
  }, [annee, regie, charger]);

  async function onEnregistrer(rows: LigneGrilleMensuelle[]) {
    if (annee == null) return;
    setEnCours(true);
    try {
      const res = await enregistrerGrille(annee, TYPE_PAR_REGIE[regie], {
        unite_saisie: regie === "DGDDI" ? "FCFA" : "MILLIONS",
        lignes: lignesVersApi(rows),
      });
      setLignes(grilleApiVersLignes(res.grille));
      toast.success("Plan enregistré.");
    } finally {
      setEnCours(false);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        {(["DGI", "DGH", "DGDDI"] as Regie[]).map((r) => (
          <button
            key={r}
            type="button"
            onClick={() => setRegie(r)}
            className={`h-9 rounded-[10px] border px-3.5 text-sm font-medium ${
              regie === r
                ? "border-[#2a7f62] bg-[#2a7f62] text-white"
                : "border-[#e2e8f0] bg-white text-[#0f172a]"
            }`}
          >
            {r}
          </button>
        ))}
        <span className="ml-2 text-[12.5px] text-[#64748b]">
          Unité : {UNITES[regie]} · Réf. 2025 : {REF_2025[regie]}
          {annee != null ? ` · Exercice ${annee}` : null}
        </span>
      </div>
      <SofGrilleMensuellePage
        key={`${regie}-${annee ?? "x"}`}
        config={{
          titre: `Plans de trésorerie · ${regie}`,
          description:
            "Prévisions mensuelles des régies (Prévisions.xlsm). Stockage en FCFA.",
          remplace: "Prévisions.xlsm",
          importLabel: "Importer",
          lignes: lignes.length ? lignes : modele,
          chargement: chargementEx || chargement || annee == null,
          enCours,
          onEnregistrer,
          onImporter: () =>
            toast.message(
              "Import Excel — convertir millions→FCFA pour DGI/DGH puis PUT grille.",
            ),
        }}
      />
    </div>
  );
}

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { ModulePagePlaceholder } from "@/shared/components/module-page/ModulePagePlaceholder";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/shared/components/ui/tabs";
import { listerRubriquesDepenses, listerRubriquesRecettes } from "@/portails/Sof/api/referentiel";
import { ArbreRubriques, type NoeudRubrique } from "@/portails/Sof/components/referentiel/ArbreRubriques";
import type { RubriqueDepenseNoeud, RubriqueRecetteNoeud } from "@/portails/Sof/types/referentiel.interface";

const SECTIONS = [
  { valeur: "petrole", libelle: "Pétrole" },
  { valeur: "recettes_fiscales", libelle: "Recettes fiscales" },
  { valeur: "recettes_non_fiscales", libelle: "Recettes non fiscales" },
  { valeur: "recettes_affectees", libelle: "Recettes affectées" },
  { valeur: "emprunt", libelle: "Emprunt" },
  { valeur: "non_budgetaire", libelle: "Non budgétaire" },
];

const NATURES = [
  { valeur: "exercice_courant", libelle: "Exercice courant" },
  { valeur: "ex_anterieur", libelle: "Exercice antérieur" },
  { valeur: "sans_ordonnancement", libelle: "Sans ordonnancement" },
];

function recetteVersNoeud(r: RubriqueRecetteNoeud): NoeudRubrique {
  return {
    code: r.code,
    libelle: r.libelle,
    niveau: r.niveau,
    code_synthetique: r.code_synthetique,
    famille: r.section,
    famille_libelle: r.section_libelle,
    enfants: r.enfants.map(recetteVersNoeud),
  };
}

function depenseVersNoeud(r: RubriqueDepenseNoeud): NoeudRubrique {
  return {
    code: r.code,
    libelle: r.libelle,
    niveau: r.niveau,
    code_synthetique: r.code_synthetique,
    famille: r.nature,
    famille_libelle: r.nature_libelle,
    enfants: r.enfants.map(depenseVersNoeud),
  };
}

export default function RubriquesBudgetaires() {
  const [recettes, setRecettes] = useState<NoeudRubrique[]>([]);
  const [depenses, setDepenses] = useState<NoeudRubrique[]>([]);
  const [chargement, setChargement] = useState(true);

  useEffect(() => {
    Promise.all([listerRubriquesRecettes(), listerRubriquesDepenses()])
      .then(([r, d]) => {
        setRecettes((r.rubriques ?? []).map(recetteVersNoeud));
        setDepenses((d.rubriques ?? []).map(depenseVersNoeud));
      })
      .catch((e) => toast.error(e instanceof Error ? e.message : "Impossible de charger la nomenclature."))
      .finally(() => setChargement(false));
  }, []);

  return (
    <ModulePagePlaceholder
      portal="sof"
      navId="sof-referentiels-rubriques"
      description="Plan de comptes SOF : rubriques de recettes et de dépenses, organisées en arbre auto-référencé."
    >
      <Card>
        <CardHeader>
          <CardTitle className="text-[15px]">Nomenclature budgétaire</CardTitle>
          <CardDescription>
            Codes métier naturels. Un code marqué « Synthétique » est un regroupement sans code officiel source.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {chargement ? (
            <div className="flex items-center justify-center gap-2 py-16 text-[13px] text-foreground/50">
              <Loader2 size={16} className="animate-spin" />
              Chargement de la nomenclature…
            </div>
          ) : (
            <Tabs defaultValue="recettes">
              <TabsList>
                <TabsTrigger value="recettes">Recettes</TabsTrigger>
                <TabsTrigger value="depenses">Dépenses</TabsTrigger>
              </TabsList>
              <TabsContent value="recettes" className="mt-4">
                <ArbreRubriques noeuds={recettes} familles={SECTIONS} labelFamille="Section" />
              </TabsContent>
              <TabsContent value="depenses" className="mt-4">
                <ArbreRubriques noeuds={depenses} familles={NATURES} labelFamille="Nature" />
              </TabsContent>
            </Tabs>
          )}
        </CardContent>
      </Card>
    </ModulePagePlaceholder>
  );
}

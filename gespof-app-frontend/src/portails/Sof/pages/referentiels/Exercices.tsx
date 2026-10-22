import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { ModulePagePlaceholder } from "@/shared/components/module-page/ModulePagePlaceholder";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/shared/components/ui/table";
import { listerExercices } from "@/portails/Sof/api/referentiel";
import type { ExerciceSof } from "@/portails/Sof/types/referentiel.interface";
import { formatMontant } from "@/shared/lib/format";

function formaterMontant(valeur: string): string {
  return formatMontant(valeur);
}

export default function Exercices() {
  const [exercices, setExercices] = useState<ExerciceSof[]>([]);
  const [chargement, setChargement] = useState(true);

  useEffect(() => {
    listerExercices()
      .then((data) => setExercices(data.exercices ?? []))
      .catch((e) => toast.error(e instanceof Error ? e.message : "Impossible de charger les exercices."))
      .finally(() => setChargement(false));
  }, []);

  return (
    <ModulePagePlaceholder
      portal="sof"
      navId="sof-referentiels-exercices"
      description="Exercices budgétaires SOF. La loi de finances reste une référence textuelle en attendant le référentiel dédié."
    >
      <Card>
        <CardHeader>
          <CardTitle className="text-[15px]">Exercices</CardTitle>
          <CardDescription>Clé métier = année. Solde d’ouverture manipulé en décimal (bcmath côté serveur).</CardDescription>
        </CardHeader>
        <CardContent>
          {chargement ? (
            <div className="flex items-center justify-center gap-2 py-16 text-[13px] text-foreground/50">
              <Loader2 size={16} className="animate-spin" />
              Chargement des exercices…
            </div>
          ) : exercices.length === 0 ? (
            <p className="rounded-xl border border-dashed px-4 py-10 text-center text-[13px] text-foreground/50">
              Aucun exercice. Chargez le référentiel (`sof:referentiel:charger`) pour créer 2025.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Année</TableHead>
                  <TableHead>Loi de finances en vigueur</TableHead>
                  <TableHead className="text-right">Solde d’ouverture</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {exercices.map((e) => (
                  <TableRow key={e.annee}>
                    <TableCell className="font-semibold">{e.annee}</TableCell>
                    <TableCell className="text-foreground/70">{e.loi_finances_en_vigueur ?? "—"}</TableCell>
                    <TableCell className="text-right font-mono">{formaterMontant(e.solde_ouverture)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </ModulePagePlaceholder>
  );
}

import { useMemo, useState } from "react";
import type { FormEvent } from "react";
import { Loader2, Search } from "lucide-react";
import { toast } from "sonner";
import { requeteApi } from "@/shared/lib/api";
import { SERVICE_REGLEMENT_ENDPOINTS } from "@/portails/Sr/api/endpoints";
import { formatMontant } from "@/shared/lib/format";
import { Button } from "@/shared/components/ui/button";
import { Checkbox } from "@/shared/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/shared/components/ui/dialog";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import { Textarea } from "@/shared/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/shared/components/ui/table";
import type { DonneesMouvement, LigneMouvement } from "@/portails/Sr/types";
import { observationsDe, versEntreeDate } from "./utils";

interface LigneFormulaireDialogProps {
  ouvert: boolean;
  famille: "numeraire" | "sigma" | null;
  ligne?: LigneMouvement;
  reference: string;
  lignesFrere: LigneMouvement[];
  onFermer: () => void;
  onEnregistre: () => Promise<void> | void;
}

export function LigneFormulaireDialog({
  ouvert,
  famille,
  ligne,
  reference,
  lignesFrere,
  onFermer,
  onEnregistre,
}: LigneFormulaireDialogProps) {
  const observationActuelle = observationsDe(ligne)[0];
  const [beneficiaire, setBeneficiaire] = useState(ligne?.beneficiaire ?? "");
  const [depenses, setDepenses] = useState(ligne ? String(ligne.depenses) : "");
  const [dateVirement, setDateVirement] = useState(versEntreeDate(ligne?.date_virement));
  const [numeroOv, setNumeroOv] = useState(ligne?.numero_ov ?? "");
  const [banque, setBanque] = useState(ligne?.banque ?? "");
  const [observationContenu, setObservationContenu] = useState(observationActuelle?.contenu ?? "");
  const [lignesAssociees, setLignesAssociees] = useState<number[]>(() =>
    observationActuelle
      ? lignesFrere
          .filter((f) => observationsDe(f).some((o) => o.id === observationActuelle.id))
          .map((f) => f.id)
      : [],
  );
  const [filtreFreres, setFiltreFreres] = useState("");
  const [soumission, setSoumission] = useState(false);

  const freresFiltres = useMemo(() => {
    const q = filtreFreres.trim().toLowerCase();
    if (!q) return lignesFrere;
    return lignesFrere.filter((f) =>
      [f.beneficiaire, f.banque, f.numero_ov].some((c) =>
        (c ?? "").toLowerCase().includes(q),
      ),
    );
  }, [filtreFreres, lignesFrere]);

  const basculerLigne = (id: number, coche: boolean) => {
    setLignesAssociees((ids) => (coche ? [...ids, id] : ids.filter((x) => x !== id)));
  };

  const selectionnerMeme = (champ: "beneficiaire" | "banque" | "numero_ov") => {
    const valeur = (
      champ === "beneficiaire" ? beneficiaire : champ === "banque" ? banque : numeroOv
    )
      .trim()
      .toLowerCase();
    if (!valeur) {
      toast.error("Renseignez d'abord cette valeur sur la ligne en cours.");
      return;
    }
    setLignesAssociees(
      lignesFrere
        .filter((f) => (f[champ] ?? "").trim().toLowerCase() === valeur)
        .map((f) => f.id),
    );
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!famille || soumission) return;

    const beneficiaireTrim = beneficiaire.trim();
    if (!beneficiaireTrim) {
      toast.error("Le bénéficiaire est requis.");
      return;
    }
    const depensesNombre = parseFloat(depenses.replace(",", "."));
    if (!Number.isFinite(depensesNombre) || depensesNombre <= 0) {
      toast.error("Le montant des dépenses doit être un nombre strictement positif.");
      return;
    }

    const corps: DonneesMouvement = {
      beneficiaire: beneficiaireTrim,
      depenses: depensesNombre,
      date_virement: dateVirement || null,
      numero_ov: numeroOv.trim() || null,
      banque: banque.trim() || null,
      observation_contenu: observationContenu.trim() || null,
      observation_lignes_associees: lignesAssociees,
    };

    const familleApi = famille === "sigma" ? "sygma" : "numeraire";
    const chemin =
      `${SERVICE_REGLEMENT_ENDPOINTS.FICHE_DETAIL}/${encodeURIComponent(reference)}/mouvements/${familleApi}` +
      (ligne ? `/${ligne.id}` : "");

    setSoumission(true);
    try {
      await requeteApi<LigneMouvement>(chemin, {
        method: ligne ? "PUT" : "POST",
        body: JSON.stringify(corps),
      });
      toast.success(ligne ? "Ligne modifiée." : "Ligne ajoutée.");
      await onEnregistre();
      onFermer();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Erreur lors de l'enregistrement de la ligne.",
      );
    } finally {
      setSoumission(false);
    }
  };

  return (
    <Dialog open={ouvert} onOpenChange={(open) => !open && !soumission && onFermer()}>
      <DialogContent
        className="flex max-h-[calc(100dvh-2rem)] w-full max-w-[95vw] flex-col overflow-hidden sm:max-w-5xl"
        onEscapeKeyDown={(e) => e.preventDefault()}
        onPointerDownOutside={(e) => e.preventDefault()}
        onInteractOutside={(e) => e.preventDefault()}
      >
        <DialogHeader className="shrink-0 pr-8">
          <DialogTitle>{ligne ? "Modifier la ligne" : "Ajouter une ligne"}</DialogTitle>
          <DialogDescription>
            Règlements {famille === "sigma" ? "sigma" : "numéraire"} — rattachez d'autres
            lignes à la même observation comme un regroupement Systac.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={(e) => void handleSubmit(e)} className="flex min-h-0 flex-1 flex-col gap-4">
          <div className="grid shrink-0 grid-cols-2 gap-3">
            <div className="col-span-2">
              <Label htmlFor="lf-beneficiaire" className="mb-1.5">
                Bénéficiaire
              </Label>
              <Input
                id="lf-beneficiaire"
                value={beneficiaire}
                onChange={(e) => setBeneficiaire(e.target.value)}
                disabled={soumission}
                required
              />
            </div>
            <div>
              <Label htmlFor="lf-depenses" className="mb-1.5">
                Dépenses (FCFA)
              </Label>
              <Input
                id="lf-depenses"
                type="number"
                min="0"
                step="0.01"
                value={depenses}
                onChange={(e) => setDepenses(e.target.value)}
                disabled={soumission}
                required
              />
            </div>
            <div>
              <Label htmlFor="lf-date" className="mb-1.5">
                Date du virement
              </Label>
              <Input
                id="lf-date"
                type="date"
                value={dateVirement}
                onChange={(e) => setDateVirement(e.target.value)}
                disabled={soumission}
              />
            </div>
            <div>
              <Label htmlFor="lf-ov" className="mb-1.5">
                N° O.V.
              </Label>
              <Input
                id="lf-ov"
                value={numeroOv}
                onChange={(e) => setNumeroOv(e.target.value)}
                disabled={soumission}
              />
            </div>
            <div>
              <Label htmlFor="lf-banque" className="mb-1.5">
                Banque
              </Label>
              <Input
                id="lf-banque"
                value={banque}
                onChange={(e) => setBanque(e.target.value)}
                disabled={soumission}
              />
            </div>
          </div>

          <div className="shrink-0">
            <Label htmlFor="lf-observation" className="mb-1.5">
              Observation
            </Label>
            <Textarea
              id="lf-observation"
              value={observationContenu}
              onChange={(e) => setObservationContenu(e.target.value)}
              disabled={soumission}
              placeholder="Remarque partagée par les lignes cochées ci-dessous…"
              className="min-h-20"
            />
          </div>

          {observationContenu.trim() !== "" && lignesFrere.length > 0 && (
            <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-hidden">
              <div className="flex shrink-0 flex-wrap items-center justify-between gap-2">
                <Label className="mb-0">Rattacher d'autres lignes à cette observation</Label>
                <span className="text-xs text-muted-foreground">
                  {lignesAssociees.length} ligne{lignesAssociees.length > 1 ? "s" : ""} sélectionnée
                  {lignesAssociees.length > 1 ? "s" : ""}
                </span>
              </div>
              <div className="flex shrink-0 flex-wrap items-center gap-2">
                <div className="relative min-w-[12rem] flex-1">
                  <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={filtreFreres}
                    onChange={(e) => setFiltreFreres(e.target.value)}
                    placeholder="Filtrer par bénéficiaire, banque, n° O.V…"
                    className="h-8 pl-8 text-xs"
                    disabled={soumission}
                  />
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-8 text-xs"
                  disabled={soumission}
                  onClick={() => selectionnerMeme("beneficiaire")}
                >
                  Même bénéficiaire
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-8 text-xs"
                  disabled={soumission}
                  onClick={() => selectionnerMeme("banque")}
                >
                  Même banque
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-8 text-xs"
                  disabled={soumission}
                  onClick={() => selectionnerMeme("numero_ov")}
                >
                  Même n° O.V.
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="h-8 text-xs"
                  disabled={soumission}
                  onClick={() => setLignesAssociees(lignesFrere.map((f) => f.id))}
                >
                  Tout
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="h-8 text-xs"
                  disabled={soumission}
                  onClick={() => setLignesAssociees([])}
                >
                  Aucun
                </Button>
              </div>
              <div className="min-h-0 flex-1 overflow-hidden rounded-md border">
                <Table containerClassName="max-h-[28vh] overflow-auto">
                  <TableHeader className="sticky top-0 z-10 bg-muted">
                    <TableRow className="bg-muted hover:bg-muted">
                      <TableHead className="w-8" />
                      <TableHead>Bénéficiaire</TableHead>
                      <TableHead>N° O.V.</TableHead>
                      <TableHead>Banque</TableHead>
                      <TableHead className="text-right">Dépenses</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {freresFiltres.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center text-muted-foreground">
                          Aucune ligne correspondante.
                        </TableCell>
                      </TableRow>
                    ) : (
                      freresFiltres.map((f) => (
                        <TableRow key={f.id}>
                          <TableCell>
                            <Checkbox
                              id={`lf-frere-${f.id}`}
                              checked={lignesAssociees.includes(f.id)}
                              onCheckedChange={(checked) => basculerLigne(f.id, checked === true)}
                              disabled={soumission}
                            />
                          </TableCell>
                          <TableCell className="max-w-[220px] truncate font-medium" title={f.beneficiaire}>
                            {f.beneficiaire}
                          </TableCell>
                          <TableCell className="whitespace-nowrap text-muted-foreground">
                            {f.numero_ov ?? "—"}
                          </TableCell>
                          <TableCell className="whitespace-nowrap text-muted-foreground">
                            {f.banque ?? "—"}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {formatMontant(String(f.depenses))}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}

          <DialogFooter className="shrink-0">
            <Button type="button" variant="outline" onClick={onFermer} disabled={soumission}>
              Annuler
            </Button>
            <Button type="submit" disabled={soumission}>
              {soumission && <Loader2 className="size-3.5 animate-spin" />}
              {ligne ? "Enregistrer" : "Ajouter"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

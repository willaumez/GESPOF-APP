import { useState } from "react";
import type { FormEvent } from "react";
import { Loader2 } from "lucide-react";
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
import type { DonneesMouvement, LigneMouvement } from "@/portails/Sr/types";
import { versEntreeDate } from "./utils";

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
  const observationActuelle = ligne?.observations[0];
  const [beneficiaire, setBeneficiaire] = useState(ligne?.beneficiaire ?? "");
  const [depenses, setDepenses] = useState(ligne ? String(ligne.depenses) : "");
  const [dateVirement, setDateVirement] = useState(versEntreeDate(ligne?.date_virement));
  const [numeroOv, setNumeroOv] = useState(ligne?.numero_ov ?? "");
  const [banque, setBanque] = useState(ligne?.banque ?? "");
  const [observationContenu, setObservationContenu] = useState(observationActuelle?.contenu ?? "");
  const [lignesAssociees, setLignesAssociees] = useState<number[]>(() =>
    observationActuelle
      ? lignesFrere
          .filter((f) => f.observations.some((o) => o.id === observationActuelle.id))
          .map((f) => f.id)
      : [],
  );
  const [soumission, setSoumission] = useState(false);

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
        className="w-full sm:max-w-xl"
        onEscapeKeyDown={(e) => e.preventDefault()}
        onPointerDownOutside={(e) => e.preventDefault()}
        onInteractOutside={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle>{ligne ? "Modifier la ligne" : "Ajouter une ligne"}</DialogTitle>
          <DialogDescription>
            Règlements {famille === "sigma" ? "sigma" : "numéraire"}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
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

          <div>
            <Label htmlFor="lf-observation" className="mb-1.5">
              Observation
            </Label>
            <Textarea
              id="lf-observation"
              value={observationContenu}
              onChange={(e) => setObservationContenu(e.target.value)}
              disabled={soumission}
              placeholder="Remarque optionnelle…"
            />
          </div>

          {observationContenu.trim() !== "" && lignesFrere.length > 0 && (
            <div>
              <Label className="mb-1.5">Aussi appliquer cette observation à…</Label>
              <div className="max-h-36 space-y-1.5 overflow-auto rounded-md border p-2">
                {lignesFrere.map((f) => (
                  <label
                    key={f.id}
                    htmlFor={`lf-frere-${f.id}`}
                    className="flex cursor-pointer items-center gap-2 text-sm"
                  >
                    <Checkbox
                      id={`lf-frere-${f.id}`}
                      checked={lignesAssociees.includes(f.id)}
                      onCheckedChange={(checked) => {
                        setLignesAssociees((ids) =>
                          checked ? [...ids, f.id] : ids.filter((id) => id !== f.id),
                        );
                      }}
                      disabled={soumission}
                    />
                    <span className="truncate">
                      {f.beneficiaire} — {formatMontant(String(f.depenses))} FCFA
                    </span>
                  </label>
                ))}
              </div>
            </div>
          )}

          <DialogFooter>
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

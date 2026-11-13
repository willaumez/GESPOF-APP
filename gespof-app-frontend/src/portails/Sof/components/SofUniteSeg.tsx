import { SofSeg } from "@/portails/Sof/components/SofSeg";
import { UNITES, type UniteMontant } from "@/portails/Sof/lib/unite-montant";

type Props = {
  value: UniteMontant;
  onChange: (u: UniteMontant) => void;
};

/** Sélecteur Unité FCFA / Millions / Milliards (maquette SOF — unitSeg). */
export function SofUniteSeg({ value, onChange }: Props) {
  return (
    <SofSeg
      label="Unité"
      options={UNITES.map((u) => ({ cle: u.cle, libelle: u.libelle }))}
      value={value}
      onChange={(cle) => onChange(cle as UniteMontant)}
    />
  );
}

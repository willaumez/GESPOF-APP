import { useRef, useState } from "react";
import type { KeyboardEvent, MouseEvent } from "react";
import { toast } from "sonner";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/shared/components/ui/table";
import { Checkbox } from "@/shared/components/ui/checkbox";
import { Input } from "@/shared/components/ui/input";
import { cn } from "@/shared/lib/utils";
import { formatMontant } from "@/shared/lib/format";
import { useAuth } from "@/shared/hooks/use-auth";
import { messageAccesRefuse } from "@/shared/lib/acces";
import type { LigneSystacDetail } from "@/portails/Sr/types";
import { styleLigneManuelle } from "./utils";
import { SYSTAC_COL_WIDTHS } from "./constants";
import { formaterDateSansHeure, versEntreeDate } from "./utils";

type ChampEditable =
  | "c_orig"
  | "l_orig"
  | "n_bv"
  | "nb_regl"
  | "montant_systac"
  | "montant_groupe"
  | "designation"
  | "d_generation";

interface TableSystacProps {
  lignes: LigneSystacDetail[];
  peutGererLignes: boolean;
  idsSelection: number[];
  onSelectionChange: (ids: number[]) => void;
  onModifierLigne: (id: number, champs: Partial<Record<ChampEditable, string | number | null>>) => void;
}

export function TableSystac({
  lignes,
  peutGererLignes,
  idsSelection,
  onSelectionChange,
  onModifierLigne,
}: TableSystacProps) {
  const { hasAcces } = useAuth();
  const autorise = hasAcces("GERER_MOUVEMENT_FICHE");
  const interactif = peutGererLignes && autorise;
  const [edition, setEdition] = useState<{
    id: number;
    champ: ChampEditable;
    valeur: string;
    idGroupe?: number;
  } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const taillesGroupes = lignes.reduce<Record<number, number>>((acc, l) => {
    acc[l.id_groupe] = (acc[l.id_groupe] ?? 0) + 1;
    return acc;
  }, {});

  const bloquer = (e: MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    toast.error(messageAccesRefuse("GERER_MOUVEMENT_FICHE"));
  };

  const basculer = (id: number, coche: boolean) => {
    onSelectionChange(coche ? [...idsSelection, id] : idsSelection.filter((x) => x !== id));
  };

  const demarrerEdition = (
    e: MouseEvent,
    ligne: LigneSystacDetail,
    champ: ChampEditable,
    valeurInitiale: string,
  ) => {
    e.stopPropagation();
    if (!peutGererLignes) return;
    if (!autorise) {
      bloquer(e);
      return;
    }
    setEdition({
      id: ligne.id,
      champ,
      valeur: valeurInitiale,
      idGroupe: ligne.id_groupe,
    });
    requestAnimationFrame(() => inputRef.current?.focus());
  };

  const valeurActuelle = (ligne: LigneSystacDetail, champ: ChampEditable): string => {
    switch (champ) {
      case "c_orig":
        return ligne.c_orig ?? "";
      case "l_orig":
        return ligne.l_orig ?? "";
      case "n_bv":
        return ligne.n_bv;
      case "nb_regl":
        return String(ligne.nb_regl);
      case "montant_systac":
        return String(ligne.montant_systac);
      case "montant_groupe":
        return String(ligne.montant_groupe);
      case "designation":
        return ligne.designation;
      case "d_generation":
        return versEntreeDate(ligne.d_generation);
      default:
        return "";
    }
  };

  const enregistrer = () => {
    if (!edition) return;
    const ligne = lignes.find((l) => l.id === edition.id);
    if (!ligne) {
      setEdition(null);
      return;
    }
    const brute = edition.valeur.trim();
    const actuelle = valeurActuelle(ligne, edition.champ).trim();
    const { id, champ } = edition;
    setEdition(null);

    if (brute === actuelle) return;

    if (champ === "n_bv" || champ === "designation") {
      if (!brute) {
        toast.error(champ === "n_bv" ? "Le N_BV est requis." : "La désignation est requise.");
        return;
      }
      onModifierLigne(id, { [champ]: brute });
      return;
    }

    if (champ === "nb_regl" || champ === "montant_systac" || champ === "montant_groupe") {
      const n = parseFloat(brute.replace(",", "."));
      if (!Number.isFinite(n)) {
        toast.error("Valeur numérique invalide.");
        return;
      }
      onModifierLigne(id, { [champ]: n });
      return;
    }

    if (champ === "d_generation") {
      onModifierLigne(id, { d_generation: brute || null });
      return;
    }

    onModifierLigne(id, { [champ]: brute || null });
  };

  const clavierEdition = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      e.currentTarget.blur();
    }
    if (e.key === "Escape") {
      e.preventDefault();
      setEdition(null);
    }
  };

  const celluleEditable = (
    ligne: LigneSystacDetail,
    champ: ChampEditable,
    affiche: string,
    className?: string,
    opts?: { type?: string; title?: string; align?: "right" },
  ) => {
    const enCours = edition?.id === ligne.id && edition.champ === champ;
    return (
      <TableCell
        className={cn(
          className,
          interactif && "cursor-text",
          opts?.align === "right" && "text-right",
        )}
        title={
          peutGererLignes
            ? (opts?.title ?? "Double-cliquer pour modifier")
            : opts?.title
        }
        onDoubleClick={(e) => demarrerEdition(e, ligne, champ, valeurActuelle(ligne, champ))}
      >
        {enCours && edition ? (
          <Input
            ref={inputRef}
            type={opts?.type ?? "text"}
            value={edition.valeur}
            onChange={(e) =>
              setEdition((ed) => (ed ? { ...ed, valeur: e.target.value } : ed))
            }
            onBlur={enregistrer}
            onKeyDown={clavierEdition}
            onClick={(e) => e.stopPropagation()}
            className={cn("h-7 text-xs", opts?.align === "right" && "text-right")}
          />
        ) : (
          affiche
        )}
      </TableCell>
    );
  };

  return (
    <Table
      containerClassName="min-h-0 flex-1 overflow-auto [scrollbar-gutter:stable]"
      className="table-fixed"
    >
      <colgroup>
        {SYSTAC_COL_WIDTHS.map((largeur, i) => (
          <col key={i} style={{ width: largeur }} />
        ))}
      </colgroup>
      <TableHeader className="sticky top-0 z-10 bg-muted">
        <TableRow className="bg-muted hover:bg-muted">
          <TableHead className="whitespace-nowrap">{interactif ? "" : "C_PCA"}</TableHead>
          <TableHead className="whitespace-nowrap">C_ORIG</TableHead>
          <TableHead className="min-w-[160px]">L_ORIG</TableHead>
          <TableHead className="whitespace-nowrap">N_BV</TableHead>
          <TableHead className="whitespace-nowrap text-right">NB_REGL</TableHead>
          <TableHead className="whitespace-nowrap text-right">MONTANT</TableHead>
          <TableHead className="whitespace-nowrap text-right">MONTANTS GROUPÉS</TableHead>
          <TableHead className="min-w-[200px]">DÉSIGNATIONS</TableHead>
          <TableHead className="whitespace-nowrap">D_GENERATION_IP</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {lignes.map((l, i) => {
          const premierDuGroupe = i === 0 || lignes[i - 1].id_groupe !== l.id_groupe;
          const dernierDuGroupe =
            i === lignes.length - 1 || lignes[i + 1].id_groupe !== l.id_groupe;
          const cochee = idsSelection.includes(l.id);
          const manuel = Boolean(l.modifie_manuellement);
          const editionDesignation =
            edition?.champ === "designation" && edition.idGroupe === l.id_groupe;
          const editionMontantGroupe =
            edition?.champ === "montant_groupe" && edition.id === l.id;

          return (
            <TableRow
              key={l.id}
              className={cn(
                !dernierDuGroupe && "border-b-0",
                cochee && "bg-primary/5",
              )}
              style={manuel && !cochee ? styleLigneManuelle() : undefined}
            >
              <TableCell className="whitespace-nowrap text-muted-foreground">
                {interactif ? (
                  <Checkbox
                    checked={cochee}
                    onCheckedChange={(v) => basculer(l.id, v === true)}
                    aria-label={`Sélectionner ${l.n_bv}`}
                  />
                ) : null}
              </TableCell>
              {celluleEditable(
                l,
                "c_orig",
                l.c_orig ?? "—",
                "whitespace-nowrap text-muted-foreground",
              )}
              {celluleEditable(
                l,
                "l_orig",
                l.l_orig ?? "—",
                "truncate text-muted-foreground",
                { title: l.l_orig ?? "Double-cliquer pour modifier" },
              )}
              {celluleEditable(
                l,
                "n_bv",
                l.n_bv,
                "whitespace-nowrap text-muted-foreground",
              )}
              {celluleEditable(
                l,
                "nb_regl",
                String(l.nb_regl),
                "whitespace-nowrap tabular-nums text-muted-foreground",
                { type: "number", align: "right" },
              )}
              {celluleEditable(
                l,
                "montant_systac",
                formatMontant(String(l.montant_systac)),
                "whitespace-nowrap tabular-nums font-medium text-foreground",
                { type: "number", align: "right" },
              )}
              {premierDuGroupe && (
                <TableCell
                  rowSpan={taillesGroupes[l.id_groupe]}
                  className={cn(
                    "whitespace-nowrap border align-middle text-right tabular-nums font-medium text-foreground",
                    interactif && "cursor-text",
                  )}
                  title={peutGererLignes ? "Double-cliquer pour modifier" : undefined}
                  onDoubleClick={(e) =>
                    demarrerEdition(e, l, "montant_groupe", String(l.montant_groupe))
                  }
                >
                  {editionMontantGroupe && edition ? (
                    <Input
                      ref={inputRef}
                      type="number"
                      value={edition.valeur}
                      onChange={(e) =>
                        setEdition((ed) => (ed ? { ...ed, valeur: e.target.value } : ed))
                      }
                      onBlur={enregistrer}
                      onKeyDown={clavierEdition}
                      onClick={(e) => e.stopPropagation()}
                      className="h-7 text-right text-xs"
                    />
                  ) : (
                    formatMontant(String(l.montant_groupe))
                  )}
                </TableCell>
              )}
              {premierDuGroupe && (
                <TableCell
                  rowSpan={taillesGroupes[l.id_groupe]}
                  className={cn(
                    "truncate border align-middle text-muted-foreground",
                    interactif && "cursor-text",
                  )}
                  title={
                    peutGererLignes
                      ? "Double-cliquer pour modifier la désignation"
                      : l.designation
                  }
                  onDoubleClick={(e) => demarrerEdition(e, l, "designation", l.designation)}
                >
                  {editionDesignation && edition ? (
                    <Input
                      ref={inputRef}
                      value={edition.valeur}
                      onChange={(e) =>
                        setEdition((ed) => (ed ? { ...ed, valeur: e.target.value } : ed))
                      }
                      onBlur={enregistrer}
                      onKeyDown={clavierEdition}
                      onClick={(e) => e.stopPropagation()}
                      className="h-7 text-xs"
                    />
                  ) : (
                    l.designation
                  )}
                </TableCell>
              )}
              {celluleEditable(
                l,
                "d_generation",
                formaterDateSansHeure(l.d_generation),
                "whitespace-nowrap text-muted-foreground",
                { type: "date" },
              )}
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}

import { useRef, useState } from "react";
import type { KeyboardEvent, MouseEvent, ReactNode } from "react";
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
import type { DonneesMouvement, LigneMouvement } from "@/portails/Sr/types";
import {
  formaterDateSansHeure,
  libelleObservations,
  observationsDe,
  regrouperParObservations,
  styleLigneManuelle,
  versEntreeDate,
} from "./utils";

type ChampEditable =
  | "date_virement"
  | "beneficiaire"
  | "numero_ov"
  | "banque"
  | "depenses"
  | "observation";

interface TableMouvementsFamilleProps {
  lignes: LigneMouvement[];
  peutGererLignes: boolean;
  idsSelection: number[];
  onSelectionChange: (ids: number[]) => void;
  onModifierLigne: (ligne: LigneMouvement, donnees: DonneesMouvement) => void;
}

export function TableMouvementsFamille({
  lignes,
  peutGererLignes,
  idsSelection,
  onSelectionChange,
  onModifierLigne,
}: TableMouvementsFamilleProps) {
  const { hasAcces } = useAuth();
  const autorise = hasAcces("GERER_MOUVEMENT_FICHE");
  const interactif = peutGererLignes && autorise;
  const [edition, setEdition] = useState<{
    id: number;
    champ: ChampEditable;
    valeur: string;
  } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

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
    ligne: LigneMouvement,
    champ: ChampEditable,
    valeur: string,
  ) => {
    e.stopPropagation();
    if (!peutGererLignes) return;
    if (!autorise) {
      bloquer(e);
      return;
    }
    setEdition({ id: ligne.id, champ, valeur });
    requestAnimationFrame(() => inputRef.current?.focus());
  };

  const construireDonnees = (ligne: LigneMouvement, patch: Partial<DonneesMouvement>): DonneesMouvement => {
    const obs = observationsDe(ligne)[0];
    const associees = obs
      ? lignes
          .filter((f) => observationsDe(f).some((o) => o.id === obs.id) && f.id !== ligne.id)
          .map((f) => f.id)
      : [];

    return {
      beneficiaire: ligne.beneficiaire,
      depenses: ligne.depenses,
      date_virement: versEntreeDate(ligne.date_virement) || null,
      numero_ov: ligne.numero_ov,
      banque: ligne.banque,
      observation_contenu: obs?.contenu ?? null,
      observation_lignes_associees: associees,
      ...patch,
    };
  };

  const enregistrer = () => {
    if (!edition) return;
    const ligne = lignes.find((l) => l.id === edition.id);
    if (!ligne) {
      setEdition(null);
      return;
    }

    const brute = edition.valeur.trim();
    const { champ } = edition;
    setEdition(null);

    if (champ === "beneficiaire") {
      if (!brute) {
        toast.error("Le bénéficiaire est requis.");
        return;
      }
      if (brute === ligne.beneficiaire) return;
      onModifierLigne(ligne, construireDonnees(ligne, { beneficiaire: brute }));
      return;
    }

    if (champ === "depenses") {
      const n = parseFloat(brute.replace(",", "."));
      if (!Number.isFinite(n) || n < 0) {
        toast.error("Le montant des dépenses doit être un nombre positif ou nul.");
        return;
      }
      const obs = observationsDe(ligne)[0];
      const sommeGroupe = obs
        ? lignes
            .filter((f) => observationsDe(f).some((o) => o.id === obs.id))
            .reduce((s, f) => s + (Number(f.depenses) || 0), 0)
        : ligne.depenses;
      if (n === sommeGroupe) return;
      // Total du groupe porté par la première ligne (les autres restent à 0 après regroupement).
      onModifierLigne(ligne, construireDonnees(ligne, { depenses: n }));
      return;
    }

    if (champ === "date_virement") {
      const actuelle = versEntreeDate(ligne.date_virement);
      if (brute === actuelle) return;
      onModifierLigne(ligne, construireDonnees(ligne, { date_virement: brute || null }));
      return;
    }

    if (champ === "numero_ov") {
      if ((brute || null) === (ligne.numero_ov ?? null) || (brute === "" && !ligne.numero_ov)) return;
      onModifierLigne(ligne, construireDonnees(ligne, { numero_ov: brute || null }));
      return;
    }

    if (champ === "banque") {
      if ((brute || null) === (ligne.banque ?? null) || (brute === "" && !ligne.banque)) return;
      onModifierLigne(ligne, construireDonnees(ligne, { banque: brute || null }));
      return;
    }

    if (champ === "observation") {
      const actuelle = libelleObservations(ligne);
      if (brute === actuelle) return;
      onModifierLigne(ligne, construireDonnees(ligne, { observation_contenu: brute || null }));
    }
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

  const champInline = (
    ligne: LigneMouvement,
    champ: ChampEditable,
    affiche: ReactNode,
    className?: string,
    opts?: { type?: string; title?: string; rowSpan?: number; valeurEdition?: string },
  ) => {
    const enCours = edition?.id === ligne.id && edition.champ === champ;
    return (
      <TableCell
        rowSpan={opts?.rowSpan}
        className={cn(className, interactif && "cursor-text")}
        title={peutGererLignes ? (opts?.title ?? "Double-cliquer pour modifier") : opts?.title}
        onDoubleClick={(e) => {
          let valeur = opts?.valeurEdition;
          if (valeur === undefined) {
            if (champ === "date_virement") valeur = versEntreeDate(ligne.date_virement);
            else if (champ === "beneficiaire") valeur = ligne.beneficiaire;
            else if (champ === "numero_ov") valeur = ligne.numero_ov ?? "";
            else if (champ === "banque") valeur = ligne.banque ?? "";
            else if (champ === "depenses") valeur = String(ligne.depenses);
            else if (champ === "observation") valeur = libelleObservations(ligne);
            else valeur = "";
          }
          demarrerEdition(e, ligne, champ, valeur);
        }}
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
            className="h-7 text-xs"
          />
        ) : (
          affiche
        )}
      </TableCell>
    );
  };

  return (
    <Table containerClassName="min-h-0 flex-1 overflow-auto [scrollbar-gutter:stable]">
      <TableHeader className="sticky top-0 z-10 bg-muted">
        <TableRow className="bg-muted hover:bg-muted">
          {interactif && <TableHead className="w-8 whitespace-nowrap" />}
          <TableHead className="whitespace-nowrap">Date du virement</TableHead>
          <TableHead className="min-w-[200px]">Bénéficiaires</TableHead>
          <TableHead className="whitespace-nowrap">N° O.V.</TableHead>
          <TableHead className="whitespace-nowrap">Banques</TableHead>
          <TableHead className="whitespace-nowrap text-right">Dépenses</TableHead>
          <TableHead className="min-w-[160px]">Observations</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {regrouperParObservations(lignes).map(
          ({
            ligne: l,
            premierDuGroupe,
            dernierDuGroupe,
            tailleGroupe,
            sommeDepenses,
          }) => {
            const observation = libelleObservations(l);
            const cochee = idsSelection.includes(l.id);
            const manuel = Boolean(l.modifie_manuellement);
            const editionObs =
              edition?.champ === "observation" &&
              edition.id === l.id;

            return (
              <TableRow
                key={l.id}
                className={cn(
                  !dernierDuGroupe && "border-b-0",
                  cochee && "bg-primary/5",
                )}
                style={manuel && !cochee ? styleLigneManuelle() : undefined}
              >
                {interactif && (
                  <TableCell className="whitespace-nowrap">
                    <Checkbox
                      checked={cochee}
                      onCheckedChange={(v) => basculer(l.id, v === true)}
                      aria-label={`Sélectionner ${l.beneficiaire}`}
                    />
                  </TableCell>
                )}
                {champInline(
                  l,
                  "date_virement",
                  formaterDateSansHeure(l.date_virement),
                  "whitespace-nowrap text-muted-foreground",
                  { type: "date" },
                )}
                {champInline(
                  l,
                  "beneficiaire",
                  l.beneficiaire,
                  "max-w-[260px] truncate font-medium text-foreground",
                  { title: l.beneficiaire },
                )}
                {champInline(
                  l,
                  "numero_ov",
                  l.numero_ov ?? "—",
                  "whitespace-nowrap text-muted-foreground",
                )}
                {champInline(
                  l,
                  "banque",
                  l.banque ?? "—",
                  "whitespace-nowrap text-muted-foreground",
                )}
                {premierDuGroupe &&
                  champInline(
                    l,
                    "depenses",
                    formatMontant(String(sommeDepenses)),
                    "whitespace-nowrap border text-right align-middle tabular-nums font-medium text-foreground",
                    {
                      type: "number",
                      rowSpan: tailleGroupe,
                      valeurEdition: String(sommeDepenses),
                      title: "Double-cliquer pour modifier le total des dépenses",
                    },
                  )}
                {premierDuGroupe && (
                  <TableCell
                    rowSpan={tailleGroupe}
                    className={cn(
                      "max-w-[220px] truncate border align-middle text-muted-foreground",
                      interactif && "cursor-text",
                    )}
                    title={
                      peutGererLignes
                        ? "Double-cliquer pour modifier l'observation"
                        : observation || undefined
                    }
                    onDoubleClick={(e) =>
                      demarrerEdition(e, l, "observation", libelleObservations(l))
                    }
                  >
                    {editionObs && edition ? (
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
                      observation || "—"
                    )}
                  </TableCell>
                )}
              </TableRow>
            );
          },
        )}
      </TableBody>
    </Table>
  );
}

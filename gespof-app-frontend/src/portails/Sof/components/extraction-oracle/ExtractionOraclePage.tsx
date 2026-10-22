import { useEffect, useRef, useState, type ReactNode } from "react";
import { Inbox, Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { ModulePagePlaceholder } from "@/shared/components/module-page/ModulePagePlaceholder";
import { Button } from "@/shared/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/shared/components/ui/table";
import { getPortalMenu } from "@/shared/config/menu";
import { formatMontant } from "@/shared/lib/format";
import { isoLocal, usePeriode } from "@/portails/Sof/hooks/PeriodeContext";

export type AlignementColonne = "left" | "right";

export interface ColonneExtraction<T> {
  cle: string;
  libelle: string;
  largeur?: string;
  alignement?: AlignementColonne;
  montant?: boolean;
  valeur: (ligne: T) => string | null | undefined;
}

export interface ExtractionOraclePayload<T> {
  date_debut: string;
  date_fin: string;
  lignes: T[];
  nombre: number;
  total: string;
  message: string | null;
  etape_libelle?: string;
}

interface ExtractionOraclePageProps<T> {
  navId: string;
  description: string;
  titreCarte: string;
  colonnes: ColonneExtraction<T>[];
  champTotal?: string;
  extraire: (dateDebut: string, dateFin: string) => Promise<ExtractionOraclePayload<T>>;
  cleLigne: (ligne: T, index: number) => string;
  actions?: ReactNode;
  childrenAvant?: ReactNode;
}

export function ExtractionOraclePage<T>({
  navId,
  description,
  titreCarte,
  colonnes,
  champTotal = "Total",
  extraire,
  cleLigne,
  actions,
  childrenAvant,
}: ExtractionOraclePageProps<T>) {
  const theme = getPortalMenu("sof").theme;
  const { periode, dateDebutIso, dateFinIso } = usePeriode();
  const [chargement, setChargement] = useState(false);
  const [extraction, setExtraction] = useState<ExtractionOraclePayload<T> | null>(null);
  const generation = useRef(0);
  const periodeChargee = useRef<string | null>(null);

  const periodeComplete = Boolean(periode?.from && periode?.to);
  const periodeCle =
    dateDebutIso && dateFinIso ? `${dateDebutIso}|${dateFinIso}` : null;

  useEffect(() => {
    if (!periodeCle) return;
    generation.current += 1;
    periodeChargee.current = null;
    setExtraction(null);
    setChargement(false);
  }, [periodeCle]);

  useEffect(() => {
    if (!periodeCle || !periode?.from || !periode.to) return;
    if (periodeChargee.current === periodeCle) return;
    void charger(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [periodeCle]);

  async function charger(force: boolean) {
    if (!periode?.from || !periode.to || !periodeCle) {
      toast.error("Sélectionnez une période complète (début et fin) dans la barre supérieure.");
      return;
    }
    if (!force && periodeChargee.current === periodeCle) return;

    const dateDebut = isoLocal(periode.from);
    const dateFin = isoLocal(periode.to);
    const gen = generation.current + 1;
    generation.current = gen;
    setChargement(true);

    try {
      const resultat = await extraire(dateDebut, dateFin);
      if (generation.current !== gen) return;
      setExtraction(resultat);
      periodeChargee.current = periodeCle;
    } catch (e) {
      if (generation.current !== gen) return;
      setExtraction(null);
      periodeChargee.current = null;
      toast.error(e instanceof Error ? e.message : "Impossible d’extraire les données.");
    } finally {
      if (generation.current === gen) setChargement(false);
    }
  }

  const periodeLibelle = extraction
    ? `${extraction.date_debut} → ${extraction.date_fin}`
    : periodeComplete && dateDebutIso && dateFinIso
      ? `${dateDebutIso.split("-").reverse().join("/")} → ${dateFinIso.split("-").reverse().join("/")}`
      : "—";

  return (
    <ModulePagePlaceholder
      portal="sof"
      navId={navId}
      description={description}
      actions={
        <div className="flex items-center gap-2">
          {actions}
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-2"
            disabled={!periodeComplete || chargement}
            onClick={() => void charger(true)}
          >
            {chargement ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <RefreshCw className="size-4" />
            )}
            Rafraîchir
          </Button>
        </div>
      }
    >
      {childrenAvant}
      <Card className="pt-0">
        <CardHeader
          className="border-b pt-(--card-spacing)"
          style={{
            background: `linear-gradient(180deg, ${theme.bgColor} 0%, #fff 100%)`,
            borderLeft: `4px solid ${theme.topColor}`,
          }}
        >
          <CardTitle className="text-[15px]">{titreCarte}</CardTitle>
          <CardDescription>
            {chargement
              ? "Extraction Oracle en cours…"
              : extraction
                ? `${extraction.nombre} ligne(s) · total ${formatMontant(extraction.total)} · ${periodeLibelle}`
                : periodeComplete
                  ? "Chargement automatique selon la période d’exercice."
                  : "Sélectionnez une période d’exercice dans la barre supérieure."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 pt-4">
          <TableauExtraction
            chargement={chargement}
            extraction={extraction}
            periodeComplete={periodeComplete}
            accent={theme.topColor}
            colonnes={colonnes}
            champTotal={champTotal}
            cleLigne={cleLigne}
          />
        </CardContent>
      </Card>
    </ModulePagePlaceholder>
  );
}

function TableauExtraction<T>({
  chargement,
  extraction,
  periodeComplete,
  accent,
  colonnes,
  champTotal,
  cleLigne,
}: {
  chargement: boolean;
  extraction: ExtractionOraclePayload<T> | null;
  periodeComplete: boolean;
  accent: string;
  colonnes: ColonneExtraction<T>[];
  champTotal: string;
  cleLigne: (ligne: T, index: number) => string;
}) {
  const lignes = extraction?.lignes ?? [];

  if (chargement && !extraction) {
    return (
      <div className="flex min-h-[200px] items-center justify-center gap-2 text-[13px] text-muted-foreground">
        <Loader2 className="size-5 animate-spin" style={{ color: accent }} />
        Extraction en cours…
      </div>
    );
  }

  if (lignes.length === 0) {
    return (
      <div className="flex min-h-[200px] flex-col items-center justify-center gap-2 rounded-xl border border-dashed px-4 text-center">
        <Inbox className="size-5 text-muted-foreground" aria-hidden />
        <p className="text-[13px] text-muted-foreground">
          {extraction?.message
            ?? (periodeComplete
              ? "Aucune donnée pour cette période."
              : "Choisissez une période d’exercice pour lancer l’extraction.")}
        </p>
      </div>
    );
  }

  const indexMontant = colonnes.findIndex((c) => c.montant);
  const colSpanAvant = indexMontant > 0 ? indexMontant : colonnes.length - 1;

  return (
    <Table
      className="border-separate border-spacing-0"
      containerClassName="max-h-[calc(100vh-20rem)] overflow-auto rounded-xl border"
    >
      <TableHeader className="sticky top-0 z-10 bg-muted">
        <TableRow className="hover:bg-muted">
          {colonnes.map((col) => (
            <TableHead
              key={col.cle}
              className={`bg-muted font-bold uppercase tracking-wider ${
                col.alignement === "right" ? "text-right" : ""
              } ${col.largeur ?? ""}`}
            >
              {col.libelle}
            </TableHead>
          ))}
        </TableRow>
      </TableHeader>
      <TableBody>
        {lignes.map((ligne, index) => (
          <TableRow key={cleLigne(ligne, index)}>
            {colonnes.map((col) => {
              const brut = col.valeur(ligne);
              const contenu = col.montant
                ? formatMontant(brut ?? null)
                : (brut ?? "—");
              return (
                <TableCell
                  key={col.cle}
                  className={`${col.alignement === "right" ? "text-right tabular-nums" : ""} ${
                    col.montant ? "font-semibold" : ""
                  }`}
                >
                  {contenu}
                </TableCell>
              );
            })}
          </TableRow>
        ))}
        {indexMontant >= 0 ? (
          <TableRow className="bg-muted/60 hover:bg-muted/60">
            <TableCell colSpan={colSpanAvant} className="font-bold uppercase tracking-wider">
              {champTotal}
            </TableCell>
            <TableCell className="text-right font-bold tabular-nums">
              {formatMontant(extraction?.total)}
            </TableCell>
            {colonnes.length - indexMontant - 1 > 0 ? (
              <TableCell colSpan={colonnes.length - indexMontant - 1} />
            ) : null}
          </TableRow>
        ) : null}
      </TableBody>
    </Table>
  );
}

/** Colonnes partagées pour les extractions DOPE/REGL. */
export const COLONNES_OPERATION_DOPE: ColonneExtraction<{
  d_cpta: string | null;
  c_pca: string | null;
  n_op: string | null;
  n_regl: string | null;
  c_it: string | null;
  n_mattir: string | null;
  l_np: string | null;
  c_ref1: string | null;
  m_regl: string;
  c_nop: string | null;
  c_mdr: string | null;
}>[] = [
  { cle: "d_cpta", libelle: "Date", largeur: "w-28", valeur: (l) => l.d_cpta },
  { cle: "c_pca", libelle: "PCA", largeur: "w-20", valeur: (l) => l.c_pca },
  { cle: "n_op", libelle: "N° op.", largeur: "w-24", valeur: (l) => l.n_op },
  { cle: "n_regl", libelle: "N° régl.", largeur: "w-24", valeur: (l) => l.n_regl },
  { cle: "c_it", libelle: "Compte", largeur: "w-28", valeur: (l) => l.c_it },
  { cle: "n_mattir", libelle: "Matricule", largeur: "w-28", valeur: (l) => l.n_mattir },
  { cle: "l_np", libelle: "Libellé", valeur: (l) => l.l_np },
  { cle: "c_ref1", libelle: "Réf. 1", valeur: (l) => l.c_ref1 },
  {
    cle: "m_regl",
    libelle: "Montant",
    largeur: "w-36",
    alignement: "right",
    montant: true,
    valeur: (l) => l.m_regl,
  },
  { cle: "c_nop", libelle: "Nop", largeur: "w-16", valeur: (l) => l.c_nop },
  { cle: "c_mdr", libelle: "Mdr", largeur: "w-16", valeur: (l) => l.c_mdr },
];

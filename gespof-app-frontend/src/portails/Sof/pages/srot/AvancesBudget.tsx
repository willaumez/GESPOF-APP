import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { Building2, Inbox, Loader2, RefreshCw, WalletCards } from "lucide-react";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/shared/components/ui/tabs";
import { getPortalMenu } from "@/shared/config/menu";
import { formatMontant } from "@/shared/lib/format";
import { cn } from "@/shared/lib/utils";
import { extraireAvancesEtat, extraireAvancesPoste } from "@/portails/Sof/api/depenses";
import {
  COLONNES_OPERATION_DOPE,
} from "@/portails/Sof/components/extraction-oracle/ExtractionOraclePage";
import { isoLocal, usePeriode } from "@/portails/Sof/hooks/PeriodeContext";
import type { ExtractionOperationsDope, LigneOperationDope } from "@/portails/Sof/types/depenses.interface";

type OngletAvances = "etat" | "poste";

const CLASSE_ONGLET =
  "relative z-10 h-9 flex-none gap-2 rounded-lg bg-transparent px-3.5 text-[13px] shadow-none " +
  "data-[state=inactive]:text-muted-foreground data-[state=inactive]:hover:text-foreground " +
  "data-[state=active]:bg-transparent data-[state=active]:font-semibold data-[state=active]:shadow-none " +
  "data-[state=active]:text-white data-[state=active]:[&_svg]:text-white";

const INDEX_ONGLET: Record<OngletAvances, number> = { etat: 0, poste: 1 };

export default function AvancesBudget() {
  const theme = getPortalMenu("sof").theme;
  const { periode, dateDebutIso, dateFinIso } = usePeriode();
  const [onglet, setOnglet] = useState<OngletAvances>("etat");
  const [chargementEtat, setChargementEtat] = useState(false);
  const [chargementPoste, setChargementPoste] = useState(false);
  const [extractionEtat, setExtractionEtat] = useState<ExtractionOperationsDope | null>(null);
  const [extractionPoste, setExtractionPoste] = useState<ExtractionOperationsDope | null>(null);

  const generationEtat = useRef(0);
  const generationPoste = useRef(0);
  const periodeEtatChargee = useRef<string | null>(null);
  const periodePosteChargee = useRef<string | null>(null);
  const listeRef = useRef<HTMLDivElement>(null);
  const indexPrecedent = useRef(0);
  const [indicateur, setIndicateur] = useState({ left: 0, width: 0 });
  const [indicateurPret, setIndicateurPret] = useState(false);

  const periodeComplete = Boolean(periode?.from && periode?.to);
  const periodeCle =
    dateDebutIso && dateFinIso ? `${dateDebutIso}|${dateFinIso}` : null;
  const chargementActif = onglet === "etat" ? chargementEtat : chargementPoste;
  const indexOnglet = INDEX_ONGLET[onglet];
  const versLaDroite = indexOnglet >= indexPrecedent.current;
  indexPrecedent.current = indexOnglet;

  useLayoutEffect(() => {
    const liste = listeRef.current;
    if (!liste) return;

    function mesurer() {
      const actif =
        liste?.querySelector<HTMLElement>(
          '[data-slot="tabs-trigger"][data-state="active"]',
        ) ?? null;
      if (!actif) return;
      setIndicateur({ left: actif.offsetLeft, width: actif.offsetWidth });
      setIndicateurPret(true);
    }

    mesurer();
    const observer = new ResizeObserver(mesurer);
    observer.observe(liste);
    return () => observer.disconnect();
  }, [onglet, extractionEtat?.nombre, extractionPoste?.nombre, chargementEtat, chargementPoste]);

  useEffect(() => {
    if (!periodeCle) return;
    generationEtat.current += 1;
    generationPoste.current += 1;
    periodeEtatChargee.current = null;
    periodePosteChargee.current = null;
    setExtractionEtat(null);
    setExtractionPoste(null);
    setChargementEtat(false);
    setChargementPoste(false);
  }, [periodeCle]);

  useEffect(() => {
    if (!periodeCle || !periode?.from || !periode.to) return;
    if (onglet === "etat") {
      if (periodeEtatChargee.current === periodeCle) return;
      void chargerEtat(false);
      return;
    }
    if (periodePosteChargee.current === periodeCle) return;
    void chargerPoste(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onglet, periodeCle]);

  async function chargerEtat(force: boolean) {
    if (!periode?.from || !periode.to || !periodeCle) {
      toast.error("Sélectionnez une période complète dans la barre supérieure.");
      return;
    }
    if (!force && periodeEtatChargee.current === periodeCle) return;

    const gen = generationEtat.current + 1;
    generationEtat.current = gen;
    setChargementEtat(true);
    try {
      const resultat = await extraireAvancesEtat(isoLocal(periode.from), isoLocal(periode.to));
      if (generationEtat.current !== gen) return;
      setExtractionEtat(resultat);
      periodeEtatChargee.current = periodeCle;
    } catch (e) {
      if (generationEtat.current !== gen) return;
      setExtractionEtat(null);
      periodeEtatChargee.current = null;
      toast.error(e instanceof Error ? e.message : "Impossible d’extraire les avances État.");
    } finally {
      if (generationEtat.current === gen) setChargementEtat(false);
    }
  }

  async function chargerPoste(force: boolean) {
    if (!periode?.from || !periode.to || !periodeCle) {
      toast.error("Sélectionnez une période complète dans la barre supérieure.");
      return;
    }
    if (!force && periodePosteChargee.current === periodeCle) return;

    const gen = generationPoste.current + 1;
    generationPoste.current = gen;
    setChargementPoste(true);
    try {
      const resultat = await extraireAvancesPoste(isoLocal(periode.from), isoLocal(periode.to));
      if (generationPoste.current !== gen) return;
      setExtractionPoste(resultat);
      periodePosteChargee.current = periodeCle;
    } catch (e) {
      if (generationPoste.current !== gen) return;
      setExtractionPoste(null);
      periodePosteChargee.current = null;
      toast.error(e instanceof Error ? e.message : "Impossible d’extraire les avances Poste.");
    } finally {
      if (generationPoste.current === gen) setChargementPoste(false);
    }
  }

  function rafraichir() {
    if (onglet === "etat") void chargerEtat(true);
    else void chargerPoste(true);
  }

  const periodeLibelle = (extraction: ExtractionOperationsDope | null) =>
    extraction
      ? `${extraction.date_debut} → ${extraction.date_fin}`
      : "—";

  return (
    <ModulePagePlaceholder
      portal="sof"
      navId="sof-srot-depenses-avances"
      description="Avances sur budget — comptes 4701-5* (État) et 4706-1* (Poste)."
      actions={
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="gap-2"
          disabled={!periodeComplete || chargementActif}
          onClick={rafraichir}
        >
          {chargementActif ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <RefreshCw className="size-4" />
          )}
          Rafraîchir
        </Button>
      }
    >
      <Tabs value={onglet} onValueChange={(v) => setOnglet(v as OngletAvances)}>
        <div className="relative mb-3 inline-flex max-w-full">
          <TabsList
            ref={listeRef}
            className="relative h-auto gap-1 rounded-xl bg-muted/60 p-1"
          >
            {indicateurPret ? (
              <span
                aria-hidden
                className="pointer-events-none absolute top-1 bottom-1 rounded-lg transition-[left,width] duration-300 ease-out"
                style={{
                  left: indicateur.left,
                  width: indicateur.width,
                  background: theme.topColor,
                }}
              />
            ) : null}
            <TabsTrigger value="etat" className={CLASSE_ONGLET}>
              <Building2 className="size-3.5" />
              État (4701-5*)
              <BadgeCompte
                chargement={chargementEtat}
                nombre={extractionEtat?.nombre}
                actif={onglet === "etat"}
              />
            </TabsTrigger>
            <TabsTrigger value="poste" className={CLASSE_ONGLET}>
              <WalletCards className="size-3.5" />
              Poste (4706-1*)
              <BadgeCompte
                chargement={chargementPoste}
                nombre={extractionPoste?.nombre}
                actif={onglet === "poste"}
              />
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="etat" className="mt-0 outline-none">
          <div
            className={cn(
              "animate-in fade-in-0 duration-300 ease-out",
              versLaDroite ? "slide-in-from-right-3" : "slide-in-from-left-3",
            )}
          >
            <CarteExtraction
              theme={theme}
              titre="Avances au budget — État"
              description={
                chargementEtat
                  ? "Extraction Oracle en cours…"
                  : extractionEtat
                    ? `${extractionEtat.nombre} ligne(s) · total ${formatMontant(extractionEtat.total)} · ${periodeLibelle(extractionEtat)}`
                    : periodeComplete
                      ? "Compte 4701-5* — chargement à l’ouverture de cet onglet."
                      : "Sélectionnez une période d’exercice dans la barre supérieure."
              }
            >
              <TableauOperations
                chargement={chargementEtat}
                extraction={extractionEtat}
                periodeComplete={periodeComplete}
                accent={theme.topColor}
              />
            </CarteExtraction>
          </div>
        </TabsContent>

        <TabsContent value="poste" className="mt-0 outline-none">
          <div
            className={cn(
              "animate-in fade-in-0 duration-300 ease-out",
              versLaDroite ? "slide-in-from-right-3" : "slide-in-from-left-3",
            )}
          >
            <CarteExtraction
              theme={theme}
              titre="Avances au budget — Poste"
              description={
                chargementPoste
                  ? "Extraction Oracle en cours…"
                  : extractionPoste
                    ? `${extractionPoste.nombre} ligne(s) · total ${formatMontant(extractionPoste.total)} · ${periodeLibelle(extractionPoste)}`
                    : periodeComplete
                      ? "Compte 4706-1* — chargement à l’ouverture de cet onglet."
                      : "Sélectionnez une période d’exercice dans la barre supérieure."
              }
            >
              <TableauOperations
                chargement={chargementPoste}
                extraction={extractionPoste}
                periodeComplete={periodeComplete}
                accent={theme.topColor}
              />
            </CarteExtraction>
          </div>
        </TabsContent>
      </Tabs>
    </ModulePagePlaceholder>
  );
}

function BadgeCompte({
  chargement,
  nombre,
  actif,
}: {
  chargement: boolean;
  nombre?: number;
  actif: boolean;
}) {
  if (chargement) return <Loader2 className="size-3 animate-spin opacity-80" />;
  if (nombre == null) return null;
  return (
    <span
      className={cn(
        "ml-0.5 rounded-full px-1.5 py-0.5 text-[10px] font-semibold tabular-nums",
        actif ? "bg-white/20 text-white" : "bg-muted text-muted-foreground",
      )}
    >
      {nombre}
    </span>
  );
}

function CarteExtraction({
  theme,
  titre,
  description,
  children,
}: {
  theme: { bgColor: string; topColor: string };
  titre: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <Card className="pt-0">
      <CardHeader
        className="border-b pt-(--card-spacing)"
        style={{
          background: `linear-gradient(180deg, ${theme.bgColor} 0%, #fff 100%)`,
          borderLeft: `4px solid ${theme.topColor}`,
        }}
      >
        <CardTitle className="text-[15px]">{titre}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3 pt-4">{children}</CardContent>
    </Card>
  );
}

function TableauOperations({
  chargement,
  extraction,
  periodeComplete,
  accent,
}: {
  chargement: boolean;
  extraction: ExtractionOperationsDope | null;
  periodeComplete: boolean;
  accent: string;
}) {
  const lignes: LigneOperationDope[] = extraction?.lignes ?? [];

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

  const indexMontant = COLONNES_OPERATION_DOPE.findIndex((c) => c.montant);

  return (
    <Table
      className="border-separate border-spacing-0"
      containerClassName="max-h-[calc(100vh-22rem)] overflow-auto rounded-xl border"
    >
      <TableHeader className="sticky top-0 z-10 bg-muted">
        <TableRow className="hover:bg-muted">
          {COLONNES_OPERATION_DOPE.map((col) => (
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
          <TableRow key={`${ligne.c_pca}-${ligne.n_op}-${ligne.n_regl}-${ligne.n_lig_r}-${index}`}>
            {COLONNES_OPERATION_DOPE.map((col) => {
              const brut = col.valeur(ligne);
              return (
                <TableCell
                  key={col.cle}
                  className={`${col.alignement === "right" ? "text-right tabular-nums" : ""} ${
                    col.montant ? "font-semibold" : ""
                  }`}
                >
                  {col.montant ? formatMontant(brut ?? null) : (brut ?? "—")}
                </TableCell>
              );
            })}
          </TableRow>
        ))}
        <TableRow className="bg-muted/60 hover:bg-muted/60">
          <TableCell colSpan={indexMontant} className="font-bold uppercase tracking-wider">
            Total
          </TableCell>
          <TableCell className="text-right font-bold tabular-nums">
            {formatMontant(extraction?.total)}
          </TableCell>
          <TableCell colSpan={COLONNES_OPERATION_DOPE.length - indexMontant - 1} />
        </TableRow>
      </TableBody>
    </Table>
  );
}

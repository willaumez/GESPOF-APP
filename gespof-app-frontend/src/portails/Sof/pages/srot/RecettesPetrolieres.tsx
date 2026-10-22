import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { Building2, FileSpreadsheet, Inbox, Loader2, RefreshCw, WalletCards } from "lucide-react";
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
import {
  extraireRecettesPetrolieres1812201,
  extraireRecettesPetrolieresEtatParCompte,
  extraireRecettesPetrolieresOpBeac,
  injecterDetailsEtax,
  prechargerDetailEtax,
} from "@/portails/Sof/api/recettes-petrolieres";
import { DialogDetailOperation } from "@/portails/Sof/components/recettes-petrolieres/DialogDetailOperation";
import { isoLocal, usePeriode } from "@/portails/Sof/hooks/PeriodeContext";
import type {
  ExtractionRecettesPetrolieres,
  ExtractionRecettesPetrolieresDetail,
  ExtractionRecettesPetrolieresEtatParCompte,
  LigneRecettePetroliereAgregee,
  LigneRecettePetroliereDetail,
  LigneRecettePetroliereEtatParCompte,
} from "@/portails/Sof/types/recettes-petrolieres.interface";

type OngletPetrolieres = "op-beac" | "1812-201" | "etat-par-compte";

const CLASSE_ONGLET =
  "relative z-10 h-9 flex-none gap-2 rounded-lg bg-transparent px-3.5 text-[13px] shadow-none " +
  "data-[state=inactive]:text-muted-foreground data-[state=inactive]:hover:text-foreground " +
  "data-[state=active]:bg-transparent data-[state=active]:font-semibold data-[state=active]:shadow-none " +
  "data-[state=active]:text-white data-[state=active]:[&_svg]:text-white";

const INDEX_ONGLET: Record<OngletPetrolieres, number> = {
  "op-beac": 0,
  "1812-201": 1,
  "etat-par-compte": 2,
};

export default function RecettesPetrolieres() {
  const theme = getPortalMenu("sof").theme;
  const { periode, dateDebutIso, dateFinIso } = usePeriode();
  const [onglet, setOnglet] = useState<OngletPetrolieres>("op-beac");

  const [chargementBeac, setChargementBeac] = useState(false);
  const [chargement1812, setChargement1812] = useState(false);
  const [chargementEtat, setChargementEtat] = useState(false);

  const [extractionBeac, setExtractionBeac] = useState<ExtractionRecettesPetrolieres | null>(null);
  const [extraction1812, setExtraction1812] = useState<ExtractionRecettesPetrolieresDetail | null>(null);
  const [extractionEtat, setExtractionEtat] = useState<ExtractionRecettesPetrolieresEtatParCompte | null>(null);
  const [ligneDetail, setLigneDetail] = useState<LigneRecettePetroliereEtatParCompte | null>(null);

  const generationBeac = useRef(0);
  const generation1812 = useRef(0);
  const generationEtat = useRef(0);
  const periodeBeacChargee = useRef<string | null>(null);
  const periode1812Chargee = useRef<string | null>(null);
  const periodeEtatChargee = useRef<string | null>(null);

  const listeRef = useRef<HTMLDivElement>(null);
  const indexPrecedent = useRef(0);
  const [indicateur, setIndicateur] = useState({ left: 0, width: 0 });
  const [indicateurPret, setIndicateurPret] = useState(false);

  const periodeComplete = Boolean(periode?.from && periode?.to);
  const periodeCle =
    dateDebutIso && dateFinIso ? `${dateDebutIso}|${dateFinIso}` : null;

  const chargementActif =
    onglet === "op-beac"
      ? chargementBeac
      : onglet === "1812-201"
        ? chargement1812
        : chargementEtat;

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
  }, [
    onglet,
    extractionBeac?.nombre,
    extraction1812?.nombre,
    extractionEtat?.nombre,
    chargementBeac,
    chargement1812,
    chargementEtat,
  ]);

  useEffect(() => {
    if (!periodeCle) return;
    generationBeac.current += 1;
    generation1812.current += 1;
    generationEtat.current += 1;
    periodeBeacChargee.current = null;
    periode1812Chargee.current = null;
    periodeEtatChargee.current = null;
    setExtractionBeac(null);
    setExtraction1812(null);
    setExtractionEtat(null);
    setChargementBeac(false);
    setChargement1812(false);
    setChargementEtat(false);
  }, [periodeCle]);

  useEffect(() => {
    if (!periodeCle || !periode?.from || !periode.to) return;

    if (onglet === "op-beac") {
      if (periodeBeacChargee.current === periodeCle) return;
      void chargerBeac(false);
      return;
    }
    if (onglet === "1812-201") {
      if (periode1812Chargee.current === periodeCle) return;
      void charger1812(false);
      return;
    }
    if (periodeEtatChargee.current === periodeCle) return;
    void chargerEtat(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onglet, periodeCle]);

  async function chargerBeac(force: boolean) {
    if (!periode?.from || !periode.to || !periodeCle) {
      toast.error("Sélectionnez une période complète (début et fin) dans la barre supérieure.");
      return;
    }
    if (!force && periodeBeacChargee.current === periodeCle) return;

    const dateDebut = isoLocal(periode.from);
    const dateFin = isoLocal(periode.to);
    const gen = generationBeac.current + 1;
    generationBeac.current = gen;
    setChargementBeac(true);

    try {
      const resultat = await extraireRecettesPetrolieresOpBeac(dateDebut, dateFin);
      if (generationBeac.current !== gen) return;
      setExtractionBeac(resultat);
      periodeBeacChargee.current = periodeCle;
    } catch (e) {
      if (generationBeac.current !== gen) return;
      setExtractionBeac(null);
      periodeBeacChargee.current = null;
      toast.error(
        e instanceof Error
          ? e.message
          : "Impossible d’extraire les encaissements OP BEAC.",
      );
    } finally {
      if (generationBeac.current === gen) setChargementBeac(false);
    }
  }

  async function charger1812(force: boolean) {
    if (!periode?.from || !periode.to || !periodeCle) {
      toast.error("Sélectionnez une période complète (début et fin) dans la barre supérieure.");
      return;
    }
    if (!force && periode1812Chargee.current === periodeCle) return;

    const dateDebut = isoLocal(periode.from);
    const dateFin = isoLocal(periode.to);
    const gen = generation1812.current + 1;
    generation1812.current = gen;
    setChargement1812(true);

    try {
      const resultat = await extraireRecettesPetrolieres1812201(dateDebut, dateFin);
      if (generation1812.current !== gen) return;
      setExtraction1812(resultat);
      periode1812Chargee.current = periodeCle;
    } catch (e) {
      if (generation1812.current !== gen) return;
      setExtraction1812(null);
      periode1812Chargee.current = null;
      toast.error(
        e instanceof Error
          ? e.message
          : "Impossible d’extraire le compte 1812-201.",
      );
    } finally {
      if (generation1812.current === gen) setChargement1812(false);
    }
  }

  async function chargerEtat(force: boolean) {
    if (!periode?.from || !periode.to || !periodeCle) {
      toast.error("Sélectionnez une période complète (début et fin) dans la barre supérieure.");
      return;
    }
    if (!force && periodeEtatChargee.current === periodeCle) return;

    const dateDebut = isoLocal(periode.from);
    const dateFin = isoLocal(periode.to);
    const gen = generationEtat.current + 1;
    generationEtat.current = gen;
    setChargementEtat(true);

    try {
      const resultat = await extraireRecettesPetrolieresEtatParCompte(dateDebut, dateFin);
      if (generationEtat.current !== gen) return;
      injecterDetailsEtax(resultat.details_etax);
      setExtractionEtat(resultat);
      periodeEtatChargee.current = periodeCle;
    } catch (e) {
      if (generationEtat.current !== gen) return;
      setExtractionEtat(null);
      periodeEtatChargee.current = null;
      toast.error(
        e instanceof Error
          ? e.message
          : "Impossible d’extraire les états par compte.",
      );
    } finally {
      if (generationEtat.current === gen) setChargementEtat(false);
    }
  }

  function actualiserOngletActif() {
    if (onglet === "op-beac") {
      void chargerBeac(true);
      return;
    }
    if (onglet === "1812-201") {
      void charger1812(true);
      return;
    }
    void chargerEtat(true);
  }

  const periodeLibelle =
    onglet === "op-beac" && extractionBeac
      ? `${extractionBeac.date_debut} → ${extractionBeac.date_fin}`
      : onglet === "1812-201" && extraction1812
        ? `${extraction1812.date_debut} → ${extraction1812.date_fin}`
        : onglet === "etat-par-compte" && extractionEtat
          ? `${extractionEtat.date_debut} → ${extractionEtat.date_fin}`
          : periodeComplete && dateDebutIso && dateFinIso
            ? `${dateDebutIso} → ${dateFinIso}`
            : null;

  return (
    <ModulePagePlaceholder
      portal="sof"
      navId="sof-srot-recettes-petrolieres"
      description="Chaque onglet charge ses données indépendamment sur la période d’exercice."
      actions={
        <Button
          type="button"
          variant="outline"
          disabled={!periodeComplete || chargementActif}
          onClick={() => actualiserOngletActif()}
        >
          {chargementActif ? <Loader2 className="animate-spin" /> : <RefreshCw />}
          Actualiser
        </Button>
      }
    >
      <Tabs
        value={onglet}
        onValueChange={(v) => setOnglet(v as OngletPetrolieres)}
        className="gap-5"
      >
        <div
          className="rounded-xl border px-3 py-2.5"
          style={{
            borderColor: `${theme.topColor}28`,
            background: `linear-gradient(135deg, ${theme.bgColor} 0%, #fff 70%)`,
          }}
        >
          <TabsList
            ref={listeRef}
            className="relative h-10 gap-1 border border-border/60 bg-white/80 p-1 shadow-inner"
          >
            <span
              aria-hidden
              className={cn(
                "pointer-events-none absolute top-1 h-8 rounded-md shadow-sm",
                indicateurPret
                  ? "transition-[left,width] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]"
                  : "transition-none",
              )}
              style={{
                left: indicateur.left,
                width: indicateur.width,
                background: theme.topColor,
              }}
            />
            <TabsTrigger value="op-beac" className={CLASSE_ONGLET}>
              <BadgeOnglet lettre="A" actif={onglet === "op-beac"} />
              <Building2 className="size-3.5" />
              OP-BEAC
              <BadgeCompte
                chargement={chargementBeac}
                nombre={extractionBeac?.nombre}
                actif={onglet === "op-beac"}
              />
            </TabsTrigger>
            <TabsTrigger value="1812-201" className={CLASSE_ONGLET}>
              <BadgeOnglet lettre="B" actif={onglet === "1812-201"} />
              <WalletCards className="size-3.5" />
              Compte 1812-201
              <BadgeCompte
                chargement={chargement1812}
                nombre={extraction1812?.nombre}
                actif={onglet === "1812-201"}
              />
            </TabsTrigger>
            <TabsTrigger value="etat-par-compte" className={CLASSE_ONGLET}>
              <BadgeOnglet lettre="C" actif={onglet === "etat-par-compte"} />
              <FileSpreadsheet className="size-3.5" />
              États par compte
              <BadgeCompte
                chargement={chargementEtat}
                nombre={extractionEtat?.nombre}
                actif={onglet === "etat-par-compte"}
              />
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="op-beac" className="mt-0 outline-none">
          <div
            key="op-beac"
            className={cn(
              "animate-in fade-in-0 duration-300 ease-out",
              versLaDroite ? "slide-in-from-right-3" : "slide-in-from-left-3",
            )}
          >
            <CarteExtraction
              theme={theme}
              titre="Encaissements OP-BEAC"
              description={
                chargementBeac
                  ? "Extraction Oracle en cours…"
                  : extractionBeac
                    ? `${extractionBeac.nombre} type(s) · total ${formatMontant(extractionBeac.total)} · ${periodeLibelle}`
                    : periodeComplete
                      ? "Agrégation STAT.VM_REC_BEAC — chargement à l’ouverture de cet onglet."
                      : "Sélectionnez une période d’exercice dans la barre supérieure."
              }
            >
              <TableauAgrege
                chargement={chargementBeac}
                extraction={extractionBeac}
                periodeComplete={periodeComplete}
                accent={theme.topColor}
              />
            </CarteExtraction>
          </div>
        </TabsContent>

        <TabsContent value="1812-201" className="mt-0 outline-none">
          <div
            key="1812-201"
            className={cn(
              "animate-in fade-in-0 duration-300 ease-out",
              versLaDroite ? "slide-in-from-right-3" : "slide-in-from-left-3",
            )}
          >
            <CarteExtraction
              theme={theme}
              titre="Compte 1812-201"
              description={
                chargement1812
                  ? "Extraction Oracle en cours…"
                  : extraction1812
                    ? `${extraction1812.nombre} ligne(s) · total ${formatMontant(extraction1812.total)} · ${periodeLibelle}`
                    : periodeComplete
                      ? "Lignes hors N/A — chargement à l’ouverture de cet onglet."
                      : "Sélectionnez une période d’exercice dans la barre supérieure."
              }
            >
              <TableauDetail1812
                chargement={chargement1812}
                extraction={extraction1812}
                periodeComplete={periodeComplete}
                accent={theme.topColor}
              />
            </CarteExtraction>
          </div>
        </TabsContent>

        <TabsContent value="etat-par-compte" className="mt-0 outline-none">
          <div
            key="etat-par-compte"
            className={cn(
              "animate-in fade-in-0 duration-300 ease-out",
              versLaDroite ? "slide-in-from-right-3" : "slide-in-from-left-3",
            )}
          >
            <CarteExtraction
              theme={theme}
              titre="États par compte"
              description={
                chargementEtat
                  ? "Extraction Oracle en cours…"
                  : extractionEtat
                    ? `${extractionEtat.nombre} opération(s) · total ${formatMontant(extractionEtat.total)} · ${periodeLibelle}`
                    : periodeComplete
                      ? "Détail OP_BEAC + E-TAX — chargement à l’ouverture de cet onglet."
                      : "Sélectionnez une période d’exercice dans la barre supérieure."
              }
            >
              <TableauEtatParCompte
                chargement={chargementEtat}
                extraction={extractionEtat}
                periodeComplete={periodeComplete}
                accent={theme.topColor}
                onSelectLigne={setLigneDetail}
                onPrechargerLigne={(ligne) => prechargerDetailEtax(ligne.ref_etax)}
              />
            </CarteExtraction>
          </div>
        </TabsContent>
      </Tabs>

      <DialogDetailOperation
        ligne={ligneDetail}
        onClose={() => setLigneDetail(null)}
      />
    </ModulePagePlaceholder>
  );
}

function BadgeOnglet({ lettre, actif }: { lettre: string; actif: boolean }) {
  return (
    <span
      className={cn(
        "flex size-5 items-center justify-center rounded-md text-[10px] font-bold tracking-wide",
        actif ? "bg-white/20 text-white" : "bg-[#2a7f62]/12 text-[#2a7f62]",
      )}
    >
      {lettre}
    </span>
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
  if (chargement) {
    return <Loader2 className="size-3 animate-spin opacity-80" />;
  }
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

function TableauAgrege({
  chargement,
  extraction,
  periodeComplete,
  accent,
}: {
  chargement: boolean;
  extraction: ExtractionRecettesPetrolieres | null;
  periodeComplete: boolean;
  accent: string;
}) {
  const lignes: LigneRecettePetroliereAgregee[] = extraction?.lignes ?? [];

  if (chargement && !extraction) {
    return (
      <div className="flex min-h-[200px] items-center justify-center gap-2 text-[13px] text-muted-foreground">
        <Loader2 className="size-5 animate-spin" style={{ color: accent }} />
        Chargement OP-BEAC…
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

  return (
    <Table
      className="border-separate border-spacing-0"
      containerClassName="max-h-[calc(100vh-20rem)] overflow-auto rounded-xl border"
    >
      <TableHeader className="sticky top-0 z-10 bg-muted">
        <TableRow className="hover:bg-muted">
          <TableHead className="w-28 bg-muted font-bold uppercase tracking-wider">Code</TableHead>
          <TableHead className="bg-muted font-bold uppercase tracking-wider">Type de recette</TableHead>
          <TableHead className="w-44 bg-muted text-right font-bold uppercase tracking-wider">
            Montant (FCFA)
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {lignes.map((ligne) => (
          <TableRow key={`${ligne.code}-${ligne.type_recette}`}>
            <TableCell className="font-mono text-[13px] tabular-nums">{ligne.code ?? "—"}</TableCell>
            <TableCell className="font-medium">{ligne.type_recette ?? "—"}</TableCell>
            <TableCell className="text-right font-semibold tabular-nums">
              {formatMontant(ligne.montant)}
            </TableCell>
          </TableRow>
        ))}
        <TableRow className="bg-muted/60 hover:bg-muted/60">
          <TableCell colSpan={2} className="font-bold uppercase tracking-wider">Total</TableCell>
          <TableCell className="text-right font-bold tabular-nums">
            {formatMontant(extraction?.total)}
          </TableCell>
        </TableRow>
      </TableBody>
    </Table>
  );
}

function TableauDetail1812({
  chargement,
  extraction,
  periodeComplete,
  accent,
}: {
  chargement: boolean;
  extraction: ExtractionRecettesPetrolieresDetail | null;
  periodeComplete: boolean;
  accent: string;
}) {
  const lignes: LigneRecettePetroliereDetail[] = extraction?.lignes ?? [];

  if (chargement && !extraction) {
    return (
      <div className="flex min-h-[200px] items-center justify-center gap-2 text-[13px] text-muted-foreground">
        <Loader2 className="size-5 animate-spin" style={{ color: accent }} />
        Chargement du compte 1812-201…
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
              ? "Aucune ligne 1812-201 (hors N/A) pour cette période."
              : "Choisissez une période d’exercice pour lancer l’extraction.")}
        </p>
      </div>
    );
  }

  return (
    <Table
      className="border-separate border-spacing-0"
      containerClassName="max-h-[calc(100vh-20rem)] overflow-auto rounded-xl border"
    >
      <TableHeader className="sticky top-0 z-10 bg-muted">
        <TableRow className="hover:bg-muted">
          <TableHead className="w-28 bg-muted font-bold uppercase tracking-wider">Date</TableHead>
          <TableHead className="w-24 bg-muted font-bold uppercase tracking-wider">N° OP</TableHead>
          <TableHead className="w-24 bg-muted font-bold uppercase tracking-wider">Code</TableHead>
          <TableHead className="bg-muted font-bold uppercase tracking-wider">Type / Nature</TableHead>
          <TableHead className="bg-muted font-bold uppercase tracking-wider">Réf. 1</TableHead>
          <TableHead className="bg-muted font-bold uppercase tracking-wider">Réf. 2</TableHead>
          <TableHead className="w-40 bg-muted text-right font-bold uppercase tracking-wider">
            Montant (FCFA)
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {lignes.map((ligne, index) => (
          <TableRow key={`${ligne.n_op}-${ligne.n_lig_op}-${ligne.d_cpta}-${index}`}>
            <TableCell className="tabular-nums text-[13px]">{ligne.d_cpta ?? "—"}</TableCell>
            <TableCell className="font-mono text-[13px] tabular-nums">{ligne.n_op ?? "—"}</TableCell>
            <TableCell className="font-mono text-[13px] tabular-nums">{ligne.code ?? "—"}</TableCell>
            <TableCell className="font-medium">
              {ligne.type_recette ?? ligne.libelle_nature ?? "Transferts"}
            </TableCell>
            <TableCell className="max-w-[10rem] truncate text-[13px] text-muted-foreground">
              {ligne.c_ref1 ?? "—"}
            </TableCell>
            <TableCell className="max-w-[10rem] truncate text-[13px] text-muted-foreground">
              {ligne.c_ref2 ?? "—"}
            </TableCell>
            <TableCell className="text-right font-semibold tabular-nums">
              {formatMontant(ligne.montant)}
            </TableCell>
          </TableRow>
        ))}
        <TableRow className="bg-muted/60 hover:bg-muted/60">
          <TableCell colSpan={6} className="font-bold uppercase tracking-wider">Total</TableCell>
          <TableCell className="text-right font-bold tabular-nums">
            {formatMontant(extraction?.total)}
          </TableCell>
        </TableRow>
      </TableBody>
    </Table>
  );
}

function TableauEtatParCompte({
  chargement,
  extraction,
  periodeComplete,
  accent,
  onSelectLigne,
  onPrechargerLigne,
}: {
  chargement: boolean;
  extraction: ExtractionRecettesPetrolieresEtatParCompte | null;
  periodeComplete: boolean;
  accent: string;
  onSelectLigne: (ligne: LigneRecettePetroliereEtatParCompte) => void;
  onPrechargerLigne?: (ligne: LigneRecettePetroliereEtatParCompte) => void;
}) {
  const lignes: LigneRecettePetroliereEtatParCompte[] = extraction?.lignes ?? [];

  if (chargement && !extraction) {
    return (
      <div className="flex min-h-[200px] items-center justify-center gap-2 text-[13px] text-muted-foreground">
        <Loader2 className="size-5 animate-spin" style={{ color: accent }} />
        Chargement des états par compte…
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

  return (
    <Table
      className="border-separate border-spacing-0"
      containerClassName="max-h-[calc(100vh-20rem)] overflow-auto rounded-xl border"
    >
      <TableHeader className="sticky top-0 z-10 bg-muted">
        <TableRow className="hover:bg-muted">
          <TableHead className="w-24 bg-muted font-bold uppercase tracking-wider">Date</TableHead>
          <TableHead className="w-16 bg-muted font-bold uppercase tracking-wider">Orig</TableHead>
          <TableHead className="w-14 bg-muted font-bold uppercase tracking-wider">R/D</TableHead>
          <TableHead className="bg-muted font-bold uppercase tracking-wider">Référence</TableHead>
          <TableHead className="bg-muted font-bold uppercase tracking-wider">Tiers</TableHead>
          <TableHead className="bg-muted font-bold uppercase tracking-wider">Objet</TableHead>
          <TableHead className="w-36 bg-muted text-right font-bold uppercase tracking-wider">
            Montant
          </TableHead>
          <TableHead className="w-16 bg-muted font-bold uppercase tracking-wider">PC</TableHead>
          <TableHead className="w-28 bg-muted font-bold uppercase tracking-wider">Quittance</TableHead>
          <TableHead className="w-28 bg-muted font-bold uppercase tracking-wider">Compte</TableHead>
          <TableHead className="bg-muted font-bold uppercase tracking-wider">Réf. E-TAX</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {lignes.map((ligne, index) => (
          <TableRow
            key={`${ligne.n_regl}-${ligne.c_ref}-${ligne.d_oper}-${index}`}
            className="cursor-pointer"
            tabIndex={0}
            onMouseEnter={() => onPrechargerLigne?.(ligne)}
            onFocus={() => onPrechargerLigne?.(ligne)}
            onClick={() => onSelectLigne(ligne)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onSelectLigne(ligne);
              }
            }}
          >
            <TableCell className="tabular-nums text-[13px]">{ligne.d_oper ?? "—"}</TableCell>
            <TableCell className="text-[13px]">{ligne.orig ?? "—"}</TableCell>
            <TableCell className="font-mono text-[13px]">{ligne.c_typ ?? "—"}</TableCell>
            <TableCell className="max-w-[10rem] truncate text-[13px]">{ligne.c_ref ?? "—"}</TableCell>
            <TableCell className="max-w-[10rem] truncate font-medium">{ligne.l_tiers ?? "—"}</TableCell>
            <TableCell className="max-w-[12rem] truncate text-[13px] text-muted-foreground">
              {ligne.l_obj ?? ligne.l_com ?? "—"}
            </TableCell>
            <TableCell className="text-right font-semibold tabular-nums">
              {formatMontant(ligne.montant)}
            </TableCell>
            <TableCell className="font-mono text-[13px]">{ligne.c_pc ?? "—"}</TableCell>
            <TableCell className="font-mono text-[13px] tabular-nums">{ligne.n_regl ?? "—"}</TableCell>
            <TableCell className="font-mono text-[13px]">{ligne.compte ?? "—"}</TableCell>
            <TableCell className="max-w-[10rem] truncate text-[13px] text-muted-foreground">
              {ligne.ref_etax ?? "—"}
            </TableCell>
          </TableRow>
        ))}
        <TableRow className="bg-muted/60 hover:bg-muted/60">
          <TableCell colSpan={6} className="font-bold uppercase tracking-wider">Total</TableCell>
          <TableCell className="text-right font-bold tabular-nums">
            {formatMontant(extraction?.total)}
          </TableCell>
          <TableCell colSpan={4} />
        </TableRow>
      </TableBody>
    </Table>
  );
}

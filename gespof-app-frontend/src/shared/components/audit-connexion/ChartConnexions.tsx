import { useId, useMemo, useState } from "react";
import { Area, AreaChart, CartesianGrid, XAxis } from "recharts";
import { Users } from "lucide-react";
import type {
  AuditConnexionsPointSerie,
  AuditConnexionsUtilisateurSerie,
  AuditRepartitions,
} from "@/shared/types/audit-connexion.interface";
import { cn } from "@/shared/lib/utils";
import { Card, CardContent, CardHeader } from "@/shared/components/ui/card";
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/shared/components/ui/chart";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/components/ui/select";
import { Skeleton } from "@/shared/components/ui/skeleton";
import { Badge } from "@/shared/components/ui/badge";
import { ScrollArea } from "@/shared/components/ui/scroll-area";
import { AvatarUtilisateur } from "@/shared/components/utilisateurs/AvatarUtilisateur";
import { BadgeVous, estCompteConnecte, formaterJourCourt, formaterJourLong } from "./affichage";
import { ChartRepartitionsAudit } from "./ChartRepartitionsAudit";

const chartConfig = {
  connexions: {
    label: "Connexions",
    color: "var(--chart-1)",
  },
  deconnexions: {
    label: "Déconnexions",
    color: "var(--chart-2)",
  },
} satisfies ChartConfig;

const LIBELLES_PERIODE: Record<string, string> = {
  "7d": "7 derniers jours",
  "30d": "30 derniers jours",
  "90d": "90 derniers jours",
};

function connexionsSurPeriode(u: AuditConnexionsUtilisateurSerie, periode: string): number {
  if (periode === "7d") return u.connexions_7j;
  if (periode === "30d") return u.connexions_30j;
  return u.connexions_90j;
}

interface ChartConnexionsProps {
  serie: AuditConnexionsPointSerie[];
  parUtilisateur?: AuditConnexionsUtilisateurSerie[];
  repartitions?: AuditRepartitions;
  emailConnecte?: string;
  loading: boolean;
  dansCarte?: boolean;
  vueAdmin?: boolean;
}

export function ChartConnexions({
  serie,
  parUtilisateur = [],
  repartitions,
  emailConnecte,
  loading,
  dansCarte = false,
  vueAdmin = false,
}: ChartConnexionsProps) {
  const [periode, setPeriode] = useState("7d");
  const uid = useId().replace(/:/g, "");
  const fillConnexions = `fill-connexions-${uid}`;
  const fillDeconnexions = `fill-deconnexions-${uid}`;

  const donnees = useMemo(() => {
    const jours = periode === "7d" ? 7 : periode === "30d" ? 30 : 90;
    return serie.slice(-jours);
  }, [serie, periode]);

  const utilisateurs = useMemo(() => {
    return [...parUtilisateur]
      .map((u) => ({ ...u, connexions: connexionsSurPeriode(u, periode) }))
      .filter((u) => u.connexions > 0)
      .sort((a, b) => {
        const aMoi = estCompteConnecte(a.email, emailConnecte) ? 0 : 1;
        const bMoi = estCompteConnecte(b.email, emailConnecte) ? 0 : 1;
        if (aMoi !== bMoi) return aMoi - bMoi;
        if (a.en_ligne !== b.en_ligne) return a.en_ligne ? -1 : 1;
        return b.connexions - a.connexions;
      });
  }, [parUtilisateur, periode, emailConnecte]);

  const totalConnexions = donnees.reduce((acc, p) => acc + p.connexions, 0);
  const totalDeconnexions = donnees.reduce((acc, p) => acc + p.deconnexions, 0);

  const enTete = (
    <div className="flex flex-col items-stretch gap-3 sm:flex-row sm:items-center">
      <div className="grid flex-1 gap-1">
        <p className="text-base font-semibold leading-none">Évolution des connexions</p>
        <p className="text-sm text-muted-foreground">
          {LIBELLES_PERIODE[periode]} · {totalConnexions} connexion{totalConnexions !== 1 ? "s" : ""}
          {" · "}
          {utilisateurs.length} utilisateur{utilisateurs.length !== 1 ? "s" : ""}
          {" · "}
          {totalDeconnexions} déconnexion{totalDeconnexions !== 1 ? "s" : ""}
        </p>
      </div>
      <Select value={periode} onValueChange={setPeriode}>
        <SelectTrigger
          className="w-[180px] rounded-lg sm:ml-auto"
          aria-label="Période du graphique"
        >
          <SelectValue placeholder="Période" />
        </SelectTrigger>
        <SelectContent className="rounded-xl">
          <SelectItem value="7d" className="rounded-lg">7 derniers jours</SelectItem>
          <SelectItem value="30d" className="rounded-lg">30 derniers jours</SelectItem>
          <SelectItem value="90d" className="rounded-lg">90 derniers jours</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );

  const graphe = loading && serie.length === 0 ? (
    <Skeleton className="h-[250px] w-full rounded-xl" />
  ) : (
    <ChartContainer config={chartConfig} className="aspect-auto h-[250px] w-full">
      <AreaChart data={donnees}>
        <defs>
          <linearGradient id={fillConnexions} x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="var(--color-connexions)" stopOpacity={0.8} />
            <stop offset="95%" stopColor="var(--color-connexions)" stopOpacity={0.1} />
          </linearGradient>
          <linearGradient id={fillDeconnexions} x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="var(--color-deconnexions)" stopOpacity={0.8} />
            <stop offset="95%" stopColor="var(--color-deconnexions)" stopOpacity={0.1} />
          </linearGradient>
        </defs>
        <CartesianGrid vertical={false} />
        <XAxis
          dataKey="date"
          tickLine={false}
          axisLine={false}
          tickMargin={8}
          minTickGap={32}
          tickFormatter={formaterJourCourt}
        />
        <ChartTooltip
          cursor={false}
          content={
            <ChartTooltipContent
              labelFormatter={(value) => formaterJourLong(String(value ?? ""))}
              indicator="dot"
            />
          }
        />
        <Area
          dataKey="deconnexions"
          type="natural"
          fill={`url(#${fillDeconnexions})`}
          stroke="var(--color-deconnexions)"
          stackId="a"
        />
        <Area
          dataKey="connexions"
          type="natural"
          fill={`url(#${fillConnexions})`}
          stroke="var(--color-connexions)"
          stackId="a"
        />
        <ChartLegend content={<ChartLegendContent />} />
      </AreaChart>
    </ChartContainer>
  );

  const listeUtilisateurs = (
    <aside className="flex w-full shrink-0 flex-col overflow-hidden rounded-xl border bg-muted/30 lg:w-80">
      <header className="flex items-center justify-between gap-2 border-b px-3 py-2.5">
        <p className="flex items-center gap-1.5 text-sm font-semibold">
          <Users className="size-3.5 text-muted-foreground" />
          Utilisateurs
        </p>
        <Badge variant="secondary" className="tabular-nums">
          {utilisateurs.length}
        </Badge>
      </header>
      {loading && parUtilisateur.length === 0 ? (
        <div className="space-y-2 p-3">
          <Skeleton className="h-12 w-full rounded-lg" />
          <Skeleton className="h-12 w-full rounded-lg" />
          <Skeleton className="h-12 w-full rounded-lg" />
        </div>
      ) : utilisateurs.length === 0 ? (
        <p className="px-3 py-8 text-center text-xs text-muted-foreground">
          Aucun utilisateur sur cette période.
        </p>
      ) : (
        <ScrollArea className="h-[250px]">
          <ul className="divide-y p-1">
            {utilisateurs.map((u) => {
              const moi = estCompteConnecte(u.email, emailConnecte);
              return (
                <li
                  key={u.matricule || u.email}
                  className={cn(
                    "flex items-center gap-2.5 rounded-lg px-2 py-2",
                    moi && "bg-primary/[0.06]",
                  )}
                >
                  <span className="relative shrink-0">
                    <AvatarUtilisateur
                      id={u.id}
                      nom={u.nom}
                      prenom={u.prenom}
                      aPhoto={!!u.a_photo}
                      taille={32}
                      fondInitiales={
                        moi ? "hsl(var(--primary))" : undefined
                      }
                      couleurInitiales={
                        moi
                          ? "hsl(var(--primary-foreground))"
                          : undefined
                      }
                    />
                    {u.en_ligne && (
                      <span className="absolute -bottom-0.5 -right-0.5 size-2.5 rounded-full border-2 border-background bg-emerald-500" />
                    )}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-1 truncate text-[13px] font-medium leading-tight">
                      <span className="truncate">{u.nom_complet}</span>
                      {moi && <BadgeVous />}
                    </p>
                    <p className="truncate font-mono text-[11px] text-muted-foreground">
                      {u.matricule}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-sm font-semibold tabular-nums leading-none">
                      {u.connexions}
                    </p>
                    <p className="mt-0.5 text-[10px] text-muted-foreground">
                      connexion{u.connexions !== 1 ? "s" : ""}
                    </p>
                  </div>
                </li>
              );
            })}
          </ul>
        </ScrollArea>
      )}
    </aside>
  );

  const corps = (
    <div className="space-y-4">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-stretch">
        <div className="min-w-0 flex-1">{graphe}</div>
        {listeUtilisateurs}
      </div>
      {repartitions && (
        <ChartRepartitionsAudit
          repartitions={repartitions}
          periode={periode}
          libellePeriode={LIBELLES_PERIODE[periode] ?? periode}
          vueAdmin={vueAdmin}
        />
      )}
    </div>
  );

  if (dansCarte) {
    return (
      <div className="space-y-4 px-4 py-4 sm:px-6">
        {enTete}
        {corps}
      </div>
    );
  }

  return (
    <Card className="gap-0 pt-0">
      <CardHeader className="border-b py-5">
        {enTete}
      </CardHeader>
      <CardContent className="px-2 pt-4 sm:px-6 sm:pt-6">
        {corps}
      </CardContent>
    </Card>
  );
}

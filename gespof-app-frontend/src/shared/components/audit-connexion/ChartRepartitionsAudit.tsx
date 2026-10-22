import { TrendingUp } from "lucide-react";
import { Pie, PieChart, PolarAngleAxis, PolarGrid, Radar, RadarChart } from "recharts";
import type { AuditRepartitionPart, AuditRepartitions } from "@/shared/types/audit-connexion.interface";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/shared/components/ui/card";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/shared/components/ui/chart";

const COULEURS_SERVICE: Record<string, string> = {
  SP: "var(--chart-1)",
  SR: "var(--chart-2)",
  SOF: "var(--chart-3)",
  ADMIN: "var(--chart-4)",
};

const COULEURS_METIER: Record<string, string> = {
  agent: "var(--chart-1)",
  chef: "var(--chart-2)",
  administrateur: "var(--chart-3)",
  direction: "var(--chart-4)",
  autre: "var(--chart-5)",
};

const COULEURS_MOTIF: Record<string, string> = {
  DECONNEXION: "var(--chart-1)",
  INACTIVITE: "var(--chart-2)",
  EXPIRATION: "var(--chart-3)",
  NOUVELLE_CONNEXION: "var(--chart-4)",
};

function valeurPeriode(part: AuditRepartitionPart, periode: string): number {
  if (periode === "7d") return part.n_7j;
  if (periode === "30d") return part.n_30j;
  return part.n_90j;
}

function configEtDonnees(
  parts: AuditRepartitionPart[],
  periode: string,
  couleurs: Record<string, string>,
  inclureZeros: boolean,
) {
  const config: ChartConfig = {
    valeur: { label: "Connexions" },
  };
  const data = parts
    .map((part) => {
      config[part.cle] = {
        label: part.libelle,
        color: couleurs[part.cle] ?? "var(--chart-5)",
      };
      return {
        cle: part.cle,
        libelle: part.libelle,
        valeur: valeurPeriode(part, periode),
        fill: `var(--color-${part.cle})`,
      };
    })
    .filter((d) => inclureZeros || d.valeur > 0);

  return { config, data };
}

function synthese(data: { libelle: string; valeur: number }[]): { total: number; texte: string } {
  const total = data.reduce((acc, d) => acc + d.valeur, 0);
  if (total === 0) {
    return { total: 0, texte: "Aucune donnée sur cette période" };
  }
  const top = [...data].sort((a, b) => b.valeur - a.valeur)[0];
  const pct = Math.round((top.valeur / total) * 100);
  return { total, texte: `${top.libelle} : ${pct} %` };
}

function CamembertAudit({
  titre,
  description,
  parts,
  periode,
  couleurs,
  libellePeriode,
}: {
  titre: string;
  description: string;
  parts: AuditRepartitionPart[];
  periode: string;
  couleurs: Record<string, string>;
  libellePeriode: string;
}) {
  const { config, data } = configEtDonnees(parts, periode, couleurs, false);
  const { total, texte } = synthese(data);

  return (
    <Card className="flex flex-col">
      <CardHeader className="items-center pb-0">
        <CardTitle>{titre}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="flex-1 pb-0">
        {total === 0 ? (
          <p className="flex aspect-square max-h-[250px] items-center justify-center text-sm text-muted-foreground">
            Aucune donnée
          </p>
        ) : (
          <ChartContainer
            config={config}
            className="mx-auto aspect-square max-h-[250px] pb-0 [&_.recharts-pie-label-text]:fill-foreground"
          >
            <PieChart>
              <ChartTooltip content={<ChartTooltipContent hideLabel nameKey="cle" />} />
              <Pie data={data} dataKey="valeur" nameKey="libelle" label />
            </PieChart>
          </ChartContainer>
        )}
      </CardContent>
      <CardFooter className="flex-col gap-2 text-sm">
        <div className="flex items-center gap-2 leading-none font-medium">
          {texte} <TrendingUp className="h-4 w-4" />
        </div>
        <div className="leading-none text-muted-foreground">
          {total} connexion{total !== 1 ? "s" : ""} · {libellePeriode}
        </div>
      </CardFooter>
    </Card>
  );
}

function RadarJoursAudit({
  parts,
  periode,
  libellePeriode,
}: {
  parts: AuditRepartitionPart[];
  periode: string;
  libellePeriode: string;
}) {
  const data = parts.map((part) => ({
    jour: part.libelle,
    connexions: valeurPeriode(part, periode),
  }));
  const total = data.reduce((acc, d) => acc + d.connexions, 0);
  const { texte } = synthese(data.map((d) => ({ libelle: d.jour, valeur: d.connexions })));

  const config = {
    connexions: {
      label: "Connexions",
      color: "var(--chart-1)",
    },
  } satisfies ChartConfig;

  return (
    <Card>
      <CardHeader className="items-center">
        <CardTitle>Connexions par jour</CardTitle>
        <CardDescription>Quels jours le service est le plus sollicité</CardDescription>
      </CardHeader>
      <CardContent className="pb-0">
        <ChartContainer config={config} className="mx-auto aspect-square max-h-[250px]">
          <RadarChart data={data}>
            <ChartTooltip cursor={false} content={<ChartTooltipContent />} />
            <PolarAngleAxis dataKey="jour" />
            <PolarGrid />
            <Radar
              dataKey="connexions"
              fill="var(--color-connexions)"
              fillOpacity={0.6}
              dot={{ r: 4, fillOpacity: 1 }}
            />
          </RadarChart>
        </ChartContainer>
      </CardContent>
      <CardFooter className="flex-col gap-2 text-sm">
        <div className="flex items-center gap-2 leading-none font-medium">
          {texte} <TrendingUp className="h-4 w-4" />
        </div>
        <div className="leading-none text-muted-foreground">
          {total} connexion{total !== 1 ? "s" : ""} · {libellePeriode}
        </div>
      </CardFooter>
    </Card>
  );
}

interface ChartRepartitionsAuditProps {
  repartitions: AuditRepartitions;
  periode: string;
  libellePeriode: string;
  vueAdmin: boolean;
}

export function ChartRepartitionsAudit({
  repartitions,
  periode,
  libellePeriode,
  vueAdmin,
}: ChartRepartitionsAuditProps) {
  if (vueAdmin) {
    return (
      <div className="grid gap-4 md:grid-cols-2">
        <CamembertAudit
          titre="Répartition par service"
          description="SP, SR, SOF et Admin"
          parts={repartitions.par_service}
          periode={periode}
          couleurs={COULEURS_SERVICE}
          libellePeriode={libellePeriode}
        />
        <CamembertAudit
          titre="Répartition par métier"
          description="Agent, chef, administrateur, direction"
          parts={repartitions.par_metier}
          periode={periode}
          couleurs={COULEURS_METIER}
          libellePeriode={libellePeriode}
        />
      </div>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <CamembertAudit
        titre="Motif de déconnexion"
        description="Les agents se déconnectent-ils correctement ?"
        parts={repartitions.par_motif}
        periode={periode}
        couleurs={COULEURS_MOTIF}
        libellePeriode={libellePeriode}
      />
      <RadarJoursAudit
        parts={repartitions.par_jour_semaine}
        periode={periode}
        libellePeriode={libellePeriode}
      />
    </div>
  );
}

import { Loader2 } from "lucide-react";
import { Progress } from "@/shared/components/ui/progress";

export interface ProgressionExtraction {
  actuel: number;
  total: number;
  compte: string;
  libelle: string;
}

interface ExtractionProgressProps {
  progression: ProgressionExtraction;
  accent: string;
}

export function ExtractionProgress({ progression, accent }: ExtractionProgressProps) {
  const { actuel, total, compte, libelle } = progression;
  const indetermine = actuel <= 0;
  const pourcentage = indetermine || total === 0 ? undefined : Math.round((actuel / total) * 100);

  return (
    <div className="rounded-xl border border-[#2a7f62]/15 bg-[#f0f7f4] px-5 py-6">
      <div className="flex items-start gap-3">
        <Loader2 className="mt-0.5 size-4 shrink-0 animate-spin" style={{ color: accent }} />
        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <p className="text-[13px] font-semibold text-foreground">
              {indetermine ? "Extraction en cours" : `Extraction ${actuel} / ${total}`}
            </p>
            {!indetermine && (
              <p className="text-[12px] tabular-nums text-foreground/50">{pourcentage} %</p>
            )}
          </div>
          <p className="truncate text-[12.5px] text-foreground/65" title={`${compte} — ${libelle}`}>
            {compte !== "lot" && (
              <span className="font-mono font-semibold" style={{ color: accent }}>{compte}</span>
            )}
            {libelle ? (compte !== "lot" ? ` — ${libelle}` : libelle) : ""}
          </p>
          <Progress
            value={pourcentage}
            className="h-1.5 bg-[#2a7f62]/15"
            style={{ ["--primary" as string]: accent }}
          />
        </div>
      </div>
    </div>
  );
}

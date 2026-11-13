import { useEffect, useMemo, useState } from "react";
import { Check, Download, Loader2, Upload } from "lucide-react";
import { toast } from "sonner";
import { SofPageHeader } from "@/portails/Sof/components/layout/SofPageHeader";
import {
  CardShell,
  MONO,
  SOF_VERT,
  tdCls,
  thCls,
} from "@/portails/Sof/components/SofCards";
import { formatMontant } from "@/shared/lib/format";
import { useAuth } from "@/shared/hooks/use-auth";

const MOIS = [
  "Janv.",
  "Févr.",
  "Mars",
  "Avr.",
  "Mai",
  "Juin",
  "Juil.",
  "Août",
  "Sept.",
  "Oct.",
  "Nov.",
  "Déc.",
] as const;

export type LigneGrilleMensuelle = {
  id: string;
  libelle: string;
  code?: string;
  niveau?: number;
  calculable?: boolean;
  /** 12 montants (FCFA), index 0 = janvier. */
  mois: number[];
};

export type ConfigGrilleMensuelle = {
  titre: string;
  description: string;
  remplace?: string;
  lignes: LigneGrilleMensuelle[];
  editable?: boolean;
  importLabel?: string;
  showCumul?: boolean;
  chargement?: boolean;
  enCours?: boolean;
  onEnregistrer?: (lignes: LigneGrilleMensuelle[]) => void | Promise<void>;
  onImporter?: () => void;
  /** Bouton secondaire désactivé (ex. Reprendre depuis GESPOF). */
  actionSecondaire?: { label: string; disabled?: boolean; title?: string };
};

function totalLigne(m: number[]) {
  return m.reduce((s, x) => s + (Number.isFinite(x) ? x : 0), 0);
}

/**
 * Grille mensuelle SOF (saisie / lecture) — dépenses manuelles, plans, etc.
 */
export function SofGrilleMensuellePage({ config }: { config: ConfigGrilleMensuelle }) {
  const { hasAnyRole } = useAuth();
  const estChef = hasAnyRole(["CHEF_SOF"]);
  const peutEcrire = estChef && config.editable !== false;
  const [lignes, setLignes] = useState(config.lignes);
  const [vue, setVue] = useState<"Mois" | "Cumul">("Mois");

  useEffect(() => {
    setLignes(config.lignes);
  }, [config.lignes]);

  const totauxMois = useMemo(() => {
    const t = Array.from({ length: 12 }, () => 0);
    for (const l of lignes) {
      if (l.calculable) continue;
      l.mois.forEach((v, i) => {
        t[i] += v || 0;
      });
    }
    return t;
  }, [lignes]);

  function setCell(id: string, mi: number, raw: string) {
    const n = Number(String(raw).replace(/\s/g, "").replace(",", ".")) || 0;
    setLignes((prev) =>
      prev.map((l) =>
        l.id === id && !l.calculable
          ? { ...l, mois: l.mois.map((v, i) => (i === mi ? n : v)) }
          : l,
      ),
    );
  }

  async function enregistrer() {
    if (!config.onEnregistrer || !peutEcrire) return;
    try {
      await config.onEnregistrer(lignes);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Enregistrement impossible.");
    }
  }

  if (config.chargement) {
    return (
      <div className="flex min-h-[240px] items-center justify-center gap-2 text-[13px] text-[#64748b]">
        <Loader2 size={16} className="animate-spin" />
        Chargement…
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <SofPageHeader
        title={config.titre}
        description={config.description}
        remplace={config.remplace}
        actions={
          <div className="flex flex-wrap gap-2">
            {config.actionSecondaire ? (
              <button
                type="button"
                disabled={config.actionSecondaire.disabled !== false}
                title={config.actionSecondaire.title}
                className="inline-flex h-10 items-center gap-1.5 rounded-[10px] border border-[#e2e8f0] bg-white px-3.5 text-sm font-medium text-[#334155] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {config.actionSecondaire.label}
              </button>
            ) : null}
            {config.importLabel && (config.onImporter || peutEcrire) ? (
              <button
                type="button"
                disabled={config.enCours}
                onClick={() => {
                  if (config.onImporter) config.onImporter();
                  else toast.message("Import Excel — à brancher.");
                }}
                className="inline-flex h-10 items-center gap-1.5 rounded-[10px] border border-[#e2e8f0] bg-white px-3.5 text-sm font-medium text-[#334155] disabled:opacity-50"
              >
                <Upload className="size-4" />
                {config.importLabel}
              </button>
            ) : null}
            <button
              type="button"
              onClick={() => toast.message("Export Excel.")}
              className="inline-flex h-10 items-center gap-1.5 rounded-[10px] border border-[#e2e8f0] bg-white px-3.5 text-sm font-medium text-[#334155]"
            >
              <Download className="size-4" />
              Exporter .xlsx
            </button>
            {peutEcrire && config.onEnregistrer ? (
              <button
                type="button"
                disabled={config.enCours}
                onClick={() => void enregistrer()}
                className="inline-flex h-10 items-center gap-1.5 rounded-[10px] px-3.5 text-sm font-semibold text-white disabled:opacity-50"
                style={{
                  background: `linear-gradient(180deg, ${SOF_VERT} 0%, #1e6650 100%)`,
                }}
              >
                {config.enCours ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Check className="size-4" />
                )}
                Enregistrer
              </button>
            ) : null}
          </div>
        }
      />

      <div className="flex w-fit gap-1 rounded-[10px] border border-[#e2e8f0] bg-[#f8fafc] p-1">
        {(["Mois", "Cumul"] as const).map((v) => (
          <button
            key={v}
            type="button"
            onClick={() => setVue(v)}
            className="rounded-md px-3 py-1.5 text-[13px] font-medium"
            style={{
              background: vue === v ? "#fff" : "transparent",
              color: vue === v ? "#0f172a" : "#64748b",
              boxShadow: vue === v ? "0 1px 2px rgba(15,23,42,.06)" : undefined,
            }}
          >
            {v}
          </button>
        ))}
      </div>

      <CardShell title={config.titre} sub={`${lignes.length} lignes · montants FCFA`}>
        {lignes.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-[#64748b]">
            Aucune ligne. Importer ou enregistrer la structure.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-max min-w-full border-collapse">
              <thead>
                <tr className="border-b border-[#e2e8f0] bg-[#f8fafc]">
                  {lignes.some((l) => l.code) ? (
                    <th
                      className={`${thCls} whitespace-nowrap`}
                      style={{ textAlign: "left" }}
                    >
                      Code
                    </th>
                  ) : null}
                  <th
                    className={thCls}
                    style={{
                      textAlign: "left",
                      minWidth: 240,
                      maxWidth: 360,
                    }}
                  >
                    Libellé
                  </th>
                  {MOIS.map((m) => (
                    <th
                      key={m}
                      className={`${thCls} whitespace-nowrap`}
                      style={{ textAlign: "right", minWidth: 108 }}
                    >
                      {m}
                    </th>
                  ))}
                  {config.showCumul !== false ? (
                    <th
                      className={`${thCls} whitespace-nowrap`}
                      style={{ textAlign: "right", minWidth: 120 }}
                    >
                      Total
                    </th>
                  ) : null}
                </tr>
              </thead>
              <tbody>
                {lignes.map((l) => {
                  const cumuls = l.mois.map((_, i) =>
                    l.mois.slice(0, i + 1).reduce((s, x) => s + x, 0),
                  );
                  const vals = vue === "Cumul" ? cumuls : l.mois;
                  const editableCell =
                    peutEcrire && vue === "Mois" && !l.calculable;
                  return (
                    <tr key={l.id} className="border-b border-[#f1f5f9]">
                      {lignes.some((x) => x.code) ? (
                        <td
                          className={`${tdCls} whitespace-nowrap`}
                          style={{ fontFamily: MONO }}
                        >
                          {l.code ?? ""}
                        </td>
                      ) : null}
                      <td
                        className={tdCls}
                        style={{
                          fontWeight: (l.niveau ?? 1) === 0 ? 600 : 400,
                          paddingLeft: 10 + (l.niveau ?? 0) * 14,
                          minWidth: 240,
                          maxWidth: 360,
                          whiteSpace: "normal",
                          overflowWrap: "break-word",
                          wordBreak: "normal",
                        }}
                        title={l.libelle}
                      >
                        {l.libelle}
                      </td>
                      {vals.map((v, i) => (
                        <td
                          key={i}
                          className={`${tdCls} whitespace-nowrap`}
                          style={{ textAlign: "right", minWidth: 108 }}
                        >
                          {editableCell ? (
                            <input
                              className="h-8 w-[108px] rounded border border-[#e2e8f0] bg-white px-2 text-right text-[12.5px] outline-none focus:border-[#2a7f62]"
                              style={{ fontFamily: MONO }}
                              defaultValue={v ? String(v) : ""}
                              key={`${l.id}-${i}-${v}`}
                              onBlur={(e) => setCell(l.id, i, e.target.value)}
                            />
                          ) : (
                            <span style={{ fontFamily: MONO }}>
                              {v ? formatMontant(v) : "—"}
                            </span>
                          )}
                        </td>
                      ))}
                      {config.showCumul !== false ? (
                        <td
                          className={`${tdCls} whitespace-nowrap`}
                          style={{
                            textAlign: "right",
                            fontFamily: MONO,
                            fontWeight: 600,
                            minWidth: 120,
                          }}
                        >
                          {formatMontant(totalLigne(l.mois))}
                        </td>
                      ) : null}
                    </tr>
                  );
                })}
                <tr className="bg-[#f0f7f4]">
                  {lignes.some((x) => x.code) ? (
                    <td className={tdCls} />
                  ) : null}
                  <td
                    className={tdCls}
                    style={{ fontWeight: 600, minWidth: 240, maxWidth: 360 }}
                  >
                    Total
                  </td>
                  {totauxMois.map((v, i) => (
                    <td
                      key={i}
                      className={`${tdCls} whitespace-nowrap`}
                      style={{
                        textAlign: "right",
                        fontFamily: MONO,
                        fontWeight: 600,
                        minWidth: 108,
                      }}
                    >
                      {formatMontant(v)}
                    </td>
                  ))}
                  {config.showCumul !== false ? (
                    <td
                      className={`${tdCls} whitespace-nowrap`}
                      style={{
                        textAlign: "right",
                        fontFamily: MONO,
                        fontWeight: 600,
                        minWidth: 120,
                      }}
                    >
                      {formatMontant(totauxMois.reduce((s, x) => s + x, 0))}
                    </td>
                  ) : null}
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </CardShell>
    </div>
  );
}

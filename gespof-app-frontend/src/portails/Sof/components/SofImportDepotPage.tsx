import { useRef, useState } from "react";
import { Check, Upload, X } from "lucide-react";
import { toast } from "sonner";
import { SofPageHeader } from "@/portails/Sof/components/layout/SofPageHeader";
import {
  CardShell,
  ChipCol,
  MONO,
  SOF_VERT,
} from "@/portails/Sof/components/SofCards";

export type ConfigImportDepot = {
  titre: string;
  description: string;
  remplace: string;
  origine: string;
  requeteOracle?: string | null;
  sqlStub?: string | null;
  filtres: Array<[string, string]>;
  colonnes: string[];
  controles: string[];
  note?: string;
};

/**
 * Page d'import SOF (dépôt Excel) — maquette Imports.
 * Oracle non branché : stub SQL documenté, Excel = voie de référence.
 */
export function SofImportDepotPage({ config }: { config: ConfigImportDepot }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [fichier, setFichier] = useState<string | null>(null);
  const [statut, setStatut] = useState<"manquant" | "chargé" | "reçu">("manquant");

  function onFichier(f: File | null) {
    if (!f) return;
    setFichier(f.name);
    setStatut("chargé");
    toast.success(`Fichier « ${f.name} » chargé · à valider.`);
  }

  function annuler() {
    setFichier(null);
    setStatut("manquant");
    if (fileRef.current) fileRef.current.value = "";
    toast.message("Import annulé.");
  }

  function valider() {
    setStatut("reçu");
    toast.success("Import validé : le lot précédent est remplacé.");
  }

  const stTag =
    statut === "reçu"
      ? { l: "Reçu", bg: "#ecfdf5", fg: "#047857" }
      : statut === "chargé"
        ? { l: "À valider", bg: "#fffbeb", fg: "#b45309" }
        : { l: "Manquant", bg: "#fff1f2", fg: "#be123c" };

  const chipSt = statut === "manquant" ? "neu" : "ok";

  return (
    <div className="flex flex-col gap-6">
      <SofPageHeader
        title={config.titre}
        description={config.description}
        remplace={config.remplace}
        actions={
          statut === "chargé" ? (
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={annuler}
                className="inline-flex h-10 items-center gap-1.5 rounded-[10px] border border-[#e2e8f0] bg-white px-3.5 text-sm font-medium text-[#334155]"
              >
                <X className="size-4" />
                Annuler
              </button>
              <button
                type="button"
                onClick={valider}
                className="inline-flex h-10 items-center gap-1.5 rounded-[10px] px-3.5 text-sm font-semibold text-white"
                style={{
                  background: `linear-gradient(180deg, ${SOF_VERT} 0%, #1e6650 100%)`,
                }}
              >
                <Check className="size-4" />
                Valider l&apos;import
              </button>
            </div>
          ) : null
        }
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <CardShell title="Paramètres d'extraction" sub="Pré-remplis à partir de la période">
          <div className="grid gap-2 p-4" style={{ gridTemplateColumns: "180px 1fr" }}>
            {config.filtres.map(([l, v]) => (
              <div key={l} className="contents text-sm">
                <div className="text-[#64748b]">{l}</div>
                <div className="font-medium text-[#0f172a]" style={{ fontFamily: MONO }}>
                  {v}
                </div>
              </div>
            ))}
            <div className="contents text-sm">
              <div className="text-[#64748b]">Origine</div>
              <div className="font-medium text-[#0f172a]">{config.origine}</div>
            </div>
            {config.requeteOracle ? (
              <div className="contents text-sm">
                <div className="text-[#64748b]">Requête Oracle</div>
                <div className="font-medium text-[#0f172a]">{config.requeteOracle}</div>
              </div>
            ) : null}
          </div>
          {config.sqlStub ? (
            <p className="border-t border-[#e2e8f0] px-4 py-3 text-[12.5px] leading-relaxed text-[#64748b]">
              Extraction Oracle non validée — stub{" "}
              <span style={{ fontFamily: MONO }} className="text-[#0f172a]">
                {config.sqlStub}
              </span>
              . Le dépôt Excel reste la voie de référence.
            </p>
          ) : null}
          {config.note ? (
            <p className="border-t border-[#e2e8f0] px-4 py-3 text-[12.5px] leading-relaxed text-[#64748b]">
              {config.note}
            </p>
          ) : null}
        </CardShell>

        <CardShell
          title="Contrôles appliqués"
          sub={`${config.colonnes.length} en-têtes attendus`}
        >
          <div className="space-y-3 p-4">
            <ul className="m-0 list-disc space-y-1.5 pl-4 text-sm text-[#334155]">
              {config.controles.map((c) => (
                <li key={c}>{c}</li>
              ))}
            </ul>
            <div className="flex flex-wrap gap-1.5">
              {config.colonnes.map((cl) => (
                <ChipCol key={cl} label={cl} st={chipSt} />
              ))}
            </div>
          </div>
        </CardShell>
      </div>

      <CardShell
        title="Dépôt du fichier"
        sub={
          statut === "manquant"
            ? "En attente d'un fichier"
            : `Statut · ${stTag.l}${fichier ? ` · ${fichier}` : ""}`
        }
        headRight={
          <span
            className="rounded-full px-2.5 py-0.5 text-[11px] font-semibold"
            style={{ background: stTag.bg, color: stTag.fg }}
          >
            {stTag.l}
          </span>
        }
      >
        <div className="p-4">
          <input
            ref={fileRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            className="hidden"
            onChange={(e) => onFichier(e.target.files?.[0] ?? null)}
          />
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="inline-flex h-[50px] items-center gap-2 rounded-[10px] border border-dashed border-[#cbd5e1] bg-[#f8fafc] px-5 text-sm font-medium text-[#334155] hover:border-[#2a7f62] hover:bg-[#f0f7f4]"
          >
            <Upload className="size-4" style={{ color: SOF_VERT }} />
            Choisir un fichier Excel
          </button>
        </div>
      </CardShell>
    </div>
  );
}

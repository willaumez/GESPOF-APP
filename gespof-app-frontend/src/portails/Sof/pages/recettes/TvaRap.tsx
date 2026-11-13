import { useEffect, useMemo, useState } from "react";
import { Download, Loader2, Search } from "lucide-react";
import { toast } from "sonner";
import { SofPageHeader } from "@/portails/Sof/components/layout/SofPageHeader";
import { SofUniteSeg } from "@/portails/Sof/components/SofUniteSeg";
import {
  CardShell,
  MONO,
  SofBarreFiltres,
  SofPeriodeSelect,
  SofTag,
  btnSecondaire,
  champCls,
  dateFr,
  tdCls,
  tdMontant,
  thCls,
  usePeriodesSof,
} from "@/portails/Sof/components/SofCards";
import {
  obtenirRapTva,
  type LigneRapTva,
} from "@/portails/Sof/api/recettes-tva";
import {
  formaterSelonUnite,
  type UniteMontant,
} from "@/portails/Sof/lib/unite-montant";
import { cn } from "@/shared/lib/utils";

function exporterCsv(lignes: LigneRapTva[]) {
  const entete = [
    "Poste",
    "Mandat",
    "Émission",
    "Société",
    "Montant",
    "Périmètre",
    "Mois",
  ];
  const esc = (v: string | null | undefined) =>
    `"${String(v ?? "").replace(/"/g, '""')}"`;
  const corps = lignes.map((l) =>
    [
      l.pc,
      l.mandat,
      l.d_emis,
      l.nom,
      l.rap,
      l.petrole ? "Pétrole" : "Hors pétrole",
      l.mois_libelle,
    ]
      .map(esc)
      .join(";"),
  );
  const blob = new Blob(
    ["\uFEFF" + [entete.map(esc).join(";"), ...corps].join("\n")],
    { type: "text/csv;charset=utf-8" },
  );
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "rap-tva.csv";
  a.click();
  URL.revokeObjectURL(url);
}

export default function TvaRap() {
  const { periodes, periodeId, setPeriodeId } = usePeriodesSof();
  const [unite, setUnite] = useState<UniteMontant>("M");
  const [recherche, setRecherche] = useState("");
  const [data, setData] = useState<Awaited<
    ReturnType<typeof obtenirRapTva>
  > | null>(null);
  const [chargement, setChargement] = useState(false);

  useEffect(() => {
    if (periodeId === "") return;
    setChargement(true);
    obtenirRapTva(periodeId)
      .then(setData)
      .catch((e) =>
        toast.error(e instanceof Error ? e.message : "Chargement impossible."),
      )
      .finally(() => setChargement(false));
  }, [periodeId]);

  const lignes = useMemo(() => {
    const q = recherche.trim().toLowerCase();
    const l = data?.lignes ?? [];
    if (!q) return l;
    return l.filter((x) =>
      [x.pc, x.mandat, x.matric, x.nom, x.mois_libelle]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q)),
    );
  }, [data, recherche]);

  const totalFiltre = lignes.reduce((s, l) => s + Number(l.rap ?? 0), 0);

  return (
    <div className="flex flex-col gap-[18px]">
      <SofPageHeader
        title="RAP TVA"
        description="Mandats TVA en attente de paiement."
        remplace="Analyse TVA.xlsm"
        actions={
          <button
            type="button"
            disabled={lignes.length === 0}
            onClick={() => {
              exporterCsv(lignes);
              toast.success("Export CSV généré.");
            }}
            className={btnSecondaire}
          >
            <Download size={16} />
            Exporter
          </button>
        }
      />

      <SofBarreFiltres>
        <SofPeriodeSelect
          periodes={periodes}
          value={periodeId}
          onChange={setPeriodeId}
        />
        <label className="flex flex-col gap-1 text-[11px] font-semibold tracking-[0.06em] text-[#64748b] uppercase">
          Recherche
          <span className="relative">
            <Search
              size={14}
              className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-[#94a3b8]"
            />
            <input
              type="search"
              value={recherche}
              onChange={(e) => setRecherche(e.target.value)}
              placeholder="Mandat, société, poste…"
              className={cn(champCls, "w-[260px] pl-8 font-normal normal-case")}
            />
          </span>
        </label>
        <span className="flex-1" />
        <SofUniteSeg value={unite} onChange={setUnite} />
      </SofBarreFiltres>

      <CardShell
        title="RAP TVA"
        sub={data?.message ?? `${lignes.length.toLocaleString("fr-FR")} mandat(s)`}
      >
        {chargement ? (
          <div className="flex min-h-[160px] items-center justify-center gap-2 text-[13px] text-[#64748b]">
            <Loader2 size={16} className="animate-spin" /> Chargement…
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse" style={{ minWidth: 920 }}>
              <thead>
                <tr className="border-b border-[#e2e8f0] bg-[#f8fafc]">
                  <th className={`${thCls} text-left`} style={{ width: 70 }}>
                    Poste
                  </th>
                  <th className={`${thCls} text-left`} style={{ width: 130 }}>
                    Mandat
                  </th>
                  <th className={`${thCls} text-left`} style={{ width: 100 }}>
                    Émission
                  </th>
                  <th className={`${thCls} text-left`}>Société</th>
                  <th className={`${thCls} text-right`} style={{ width: 150 }}>
                    Montant
                  </th>
                  <th className={`${thCls} text-left`} style={{ width: 120 }}>
                    Périmètre
                  </th>
                  <th className={`${thCls} text-left`} style={{ width: 80 }}>
                    Mois
                  </th>
                </tr>
              </thead>
              <tbody>
                {lignes.length === 0 ? (
                  <tr>
                    <td
                      colSpan={7}
                      className="px-4 py-6 text-center text-[13.5px] text-[#64748b]"
                    >
                      {data?.message ?? "Aucun mandat."}
                    </td>
                  </tr>
                ) : (
                  lignes.map((l) => (
                    <tr
                      key={l.id}
                      className="border-b border-[#eef2f4] hover:bg-[#f8fafc]"
                    >
                      <td className={tdCls} style={{ fontFamily: MONO }}>
                        {l.pc ?? "—"}
                      </td>
                      <td className={tdCls} style={{ fontFamily: MONO }}>
                        {l.mandat ?? "—"}
                      </td>
                      <td className={tdCls} style={{ fontFamily: MONO }}>
                        {dateFr(l.d_emis)}
                      </td>
                      <td className={cn(tdCls, "font-medium")}>
                        {l.nom ?? "—"}
                      </td>
                      <td className={tdCls} style={tdMontant}>
                        {formaterSelonUnite(l.rap, unite)}
                      </td>
                      <td className={tdCls}>
                        {l.petrole ? (
                          <SofTag ton="ok">Pétrole</SofTag>
                        ) : (
                          <SofTag ton="neu">Hors pétrole</SofTag>
                        )}
                      </td>
                      <td className={tdCls}>
                        {l.mois_libelle
                          ? l.mois_libelle.charAt(0).toUpperCase() +
                            l.mois_libelle.slice(1, 3) +
                            "."
                          : "—"}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
              {lignes.length > 0 ? (
                <tfoot>
                  <tr
                    className="text-[13px] font-semibold"
                    style={{
                      background: "#e3f1ea",
                      borderTop: "1px solid #bfdccf",
                    }}
                  >
                    <td className={tdCls} colSpan={4}>
                      Total
                    </td>
                    <td className={tdCls} style={tdMontant}>
                      {formaterSelonUnite(totalFiltre, unite)}
                    </td>
                    <td className={tdCls} colSpan={2} />
                  </tr>
                </tfoot>
              ) : null}
            </table>
          </div>
        )}
      </CardShell>
    </div>
  );
}

import { useEffect, useMemo, useState } from "react";
import { Loader2, Save } from "lucide-react";
import { toast } from "sonner";
import { SofPageHeader } from "@/portails/Sof/components/layout/SofPageHeader";
import { SofUniteSeg } from "@/portails/Sof/components/SofUniteSeg";
import {
  CardShell,
  MONO,
  SOF_VERT,
  SofBarreFiltres,
  SofPeriodeSelect,
  btnPrimaire,
  champCls,
  moisPeriodeLibelle,
  tdCls,
  tdMontant,
  thCls,
  usePeriodesSof,
} from "@/portails/Sof/components/SofCards";
import {
  enregistrerTauxChange,
  obtenirTofeTva,
  type TofeTvaPage,
} from "@/portails/Sof/api/recettes-tva";
import {
  formaterSelonUnite,
  parseMontant,
  type UniteMontant,
} from "@/portails/Sof/lib/unite-montant";
import { useAuth } from "@/shared/hooks/use-auth";
import { formatMontant } from "@/shared/lib/format";
import { cn } from "@/shared/lib/utils";

const DEVISE = "USD";

export default function TvaSyntheseTofe() {
  const { hasAnyRole } = useAuth();
  const estChef = hasAnyRole(["CHEF_SOF"]);
  const { periodes, periodeId, setPeriodeId, periode } = usePeriodesSof();

  const [unite, setUnite] = useState<UniteMontant>("M");
  const [data, setData] = useState<TofeTvaPage | null>(null);
  const [chargement, setChargement] = useState(false);
  const [rmpUsd, setRmpUsd] = useState("");
  const [taux, setTaux] = useState("");
  const [enregistrement, setEnregistrement] = useState(false);

  async function charger(pid: number) {
    setChargement(true);
    try {
      setData(await obtenirTofeTva(pid));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Chargement impossible.");
    } finally {
      setChargement(false);
    }
  }

  useEffect(() => {
    if (periodeId === "") return;
    void charger(periodeId);
  }, [periodeId]);

  const tauxServeur = useMemo(() => {
    if (!periode) return "";
    const fromConversion = data?.conversion?.taux_usd_xaf;
    if (fromConversion && Number(fromConversion) > 0) {
      return String(Number(fromConversion));
    }
    const t = (data?.taux_change ?? []).find(
      (x) => x.mois === periode.mois && x.devise === DEVISE,
    );
    return t ? String(Number(t.taux)) : "";
  }, [data, periode]);

  useEffect(() => {
    setTaux(tauxServeur.replace(".", ","));
  }, [tauxServeur]);

  const montantXaf = parseMontant(rmpUsd) * parseMontant(taux);

  async function enregistrerTaux() {
    if (!estChef || !periode) return;
    const t = parseMontant(taux);
    if (t <= 0) {
      toast.error("Le taux doit être supérieur à 0.");
      return;
    }
    setEnregistrement(true);
    try {
      await enregistrerTauxChange({
        exercice_annee: periode.exercice_annee,
        taux: [{ mois: periode.mois, devise: DEVISE, taux: String(t) }],
      });
      toast.success("Taux de change enregistré.");
      if (periodeId !== "") await charger(periodeId);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Enregistrement impossible.");
    } finally {
      setEnregistrement(false);
    }
  }

  const lignes = (data?.lignes ?? []).map((l) =>
    l.code === "TVA-RMP-ASSALA"
      ? { ...l, montant: montantXaf > 0 ? String(Math.round(montantXaf)) : "0" }
      : l,
  );

  return (
    <div className="flex flex-col gap-[18px]">
      <SofPageHeader
        title="Synthèse TOFE"
        description="Synthèse TVA du mois pour le TOFE."
        remplace="Analyse TVA.xlsm · feuille « RMP Assala »"
      />

      <SofBarreFiltres>
        <SofPeriodeSelect
          label="Mois"
          periodes={periodes}
          value={periodeId}
          onChange={setPeriodeId}
        />
        <span className="flex-1" />
        <SofUniteSeg value={unite} onChange={setUnite} />
      </SofBarreFiltres>

      <div className="flex flex-wrap items-start gap-[18px]">
        <div className="min-w-0" style={{ flex: "2 1 480px" }}>
          <CardShell
            title={`Synthèse TOFE · ${moisPeriodeLibelle(periode)}`}
            sub={data?.message ?? undefined}
          >
            {chargement ? (
              <div className="flex min-h-[160px] items-center justify-center gap-2 text-[13px] text-[#64748b]">
                <Loader2 size={16} className="animate-spin" /> Chargement…
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table
                  className="w-full border-collapse"
                  style={{ minWidth: 520 }}
                >
                  <thead>
                    <tr className="border-b border-[#e2e8f0] bg-[#f8fafc]">
                      <th className={`${thCls} text-left`}>Rubrique</th>
                      <th className={`${thCls} text-left`} style={{ width: 120 }}>
                        Nature
                      </th>
                      <th className={`${thCls} text-right`} style={{ width: 170 }}>
                        Montant
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {lignes.length === 0 ? (
                      <tr>
                        <td
                          colSpan={3}
                          className="px-4 py-6 text-center text-[13.5px] text-[#64748b]"
                        >
                          {data?.message ?? "Aucune ligne."}
                        </td>
                      </tr>
                    ) : (
                      lignes.map((l) => (
                        <tr
                          key={l.code}
                          className="border-b border-[#eef2f4]"
                        >
                          <td className={cn(tdCls, "font-medium")}>
                            {l.libelle}
                          </td>
                          <td className={cn(tdCls, "text-[#475569]")}>
                            {l.nature ?? "—"}
                          </td>
                          <td className={tdCls} style={tdMontant}>
                            {formaterSelonUnite(l.montant, unite)}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </CardShell>
        </div>

        <div className="min-w-0" style={{ flex: "1 1 280px" }}>
          <CardShell
            title="Conversion"
            tone={{ bg: "#f0f7f4", bd: "#bfdccf" }}
            sub="RMP Assala convertie en XAF"
          >
            <div
              className="flex flex-col gap-3.5"
              style={{ padding: "14px 16px" }}
            >
              <p className="m-0 text-[13px] leading-snug text-[#334155]">
                RMP Assala déclarée en USD
                {rmpUsd.trim()
                  ? ` : ${(parseMontant(rmpUsd) / 1_000_000).toLocaleString("fr-FR", { maximumFractionDigits: 2 })} M USD.`
                  : "."}
              </p>
              <label className="flex flex-col gap-1.5">
                <span className="text-[12.5px] font-semibold text-[#334155]">
                  Montant USD
                </span>
                <input
                  type="text"
                  inputMode="decimal"
                  value={rmpUsd}
                  onChange={(e) => setRmpUsd(e.target.value)}
                  placeholder="6 420 000"
                  className={cn(champCls, "h-[38px] text-right")}
                  style={{ fontFamily: MONO }}
                />
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="text-[12.5px] font-semibold text-[#334155]">
                  Taux moyen du mois · 1 USD = … XAF (BEAC)
                </span>
                <div className="flex gap-2">
                  <input
                    type="text"
                    inputMode="decimal"
                    value={taux}
                    onChange={(e) => setTaux(e.target.value)}
                    readOnly={!estChef}
                    placeholder="605,32"
                    className={cn(
                      champCls,
                      "h-[38px] min-w-0 flex-1 text-right",
                      !estChef && "bg-[#f8fafc]",
                    )}
                    style={{ fontFamily: MONO }}
                  />
                  {estChef ? (
                    <button
                      type="button"
                      disabled={enregistrement || !periode}
                      onClick={() => void enregistrerTaux()}
                      className={btnPrimaire}
                      style={{
                        background: SOF_VERT,
                        border: `1px solid ${SOF_VERT}`,
                      }}
                    >
                      {enregistrement ? (
                        <Loader2 size={16} className="animate-spin" />
                      ) : (
                        <Save size={16} />
                      )}
                      Enregistrer
                    </button>
                  ) : null}
                </div>
              </label>
              <div
                className="rounded-md border border-[#bfdccf] bg-white text-[13.5px] text-[#1e6650]"
                style={{ padding: "10px 12px" }}
              >
                Montant retenu :{" "}
                <span className="font-semibold" style={{ fontFamily: MONO }}>
                  {montantXaf > 0
                    ? `${formatMontant(Math.round(montantXaf).toString())} FCFA`
                    : "—"}
                </span>
              </div>
            </div>
          </CardShell>
        </div>
      </div>
    </div>
  );
}

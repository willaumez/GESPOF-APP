import { useEffect, useMemo, useState } from "react";
import { Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { SofPageHeader } from "@/portails/Sof/components/layout/SofPageHeader";
import { SofSeg } from "@/portails/Sof/components/SofSeg";
import { SofUniteSeg } from "@/portails/Sof/components/SofUniteSeg";
import {
  CardShell,
  Kpi,
  MONO,
  SOF_VERT,
  SofBarreFiltres,
  SofPeriodeSelect,
  SofTag,
  btnPrimaire,
  dateFr,
  tdCls,
  tdMontant,
  thCls,
  usePeriodesSof,
} from "@/portails/Sof/components/SofCards";
import {
  obtenirRapprochementTva,
  recalculerRapprochementTva,
  type RapprochementTvaPage,
} from "@/portails/Sof/api/recettes-tva";
import {
  formaterSelonUnite,
  libelleUniteCourt,
  type UniteMontant,
} from "@/portails/Sof/lib/unite-montant";
import { useAuth } from "@/shared/hooks/use-auth";

type Afficher = "tous" | "non-trouves";

export default function TvaRapprochement() {
  const { hasAnyRole } = useAuth();
  const estChef = hasAnyRole(["CHEF_SOF"]);
  const { periodes, periodeId, setPeriodeId } = usePeriodesSof();

  const [unite, setUnite] = useState<UniteMontant>("M");
  const [afficher, setAfficher] = useState<Afficher>("tous");
  const [data, setData] = useState<RapprochementTvaPage | null>(null);
  const [chargement, setChargement] = useState(false);
  const [calcul, setCalcul] = useState(false);

  useEffect(() => {
    if (periodeId === "") return;
    setChargement(true);
    obtenirRapprochementTva(periodeId)
      .then(setData)
      .catch((e) =>
        toast.error(e instanceof Error ? e.message : "Chargement impossible."),
      )
      .finally(() => setChargement(false));
  }, [periodeId]);

  async function recalculer() {
    if (!estChef || periodeId === "") return;
    setCalcul(true);
    try {
      const res = await recalculerRapprochementTva(periodeId);
      setData(res);
      toast.success("Rapprochement recalculé.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Recalcul impossible.");
    } finally {
      setCalcul(false);
    }
  }

  const lignes = useMemo(() => {
    const l = data?.lignes ?? [];
    return afficher === "non-trouves" ? l.filter((x) => !x.apparie) : l;
  }, [data, afficher]);

  const nbNonTrouves = data?.nb_non_apparies ?? 0;
  const uL = libelleUniteCourt(unite);

  return (
    <div className="flex flex-col gap-[18px]">
      <SofPageHeader
        title="Rapprochement DC ↔ IG"
        description="Mandats DC recherchés dans les règlements IG."
        remplace="Analyse TVA.xlsm"
        actions={
          estChef ? (
            <button
              type="button"
              disabled={calcul || periodeId === ""}
              onClick={() => void recalculer()}
              className={btnPrimaire}
              style={{ background: SOF_VERT, border: `1px solid ${SOF_VERT}` }}
            >
              {calcul ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <RefreshCw size={16} />
              )}
              Recalculer
            </button>
          ) : null
        }
      />

      <SofBarreFiltres>
        <SofPeriodeSelect
          periodes={periodes}
          value={periodeId}
          onChange={setPeriodeId}
        />
        <SofSeg
          label="Afficher"
          options={[
            { cle: "tous", libelle: "Tous" },
            { cle: "non-trouves", libelle: "Non trouvés" },
          ]}
          value={afficher}
          onChange={(c) => setAfficher(c as Afficher)}
        />
        <span className="flex-1" />
        <SofUniteSeg value={unite} onChange={setUnite} />
      </SofBarreFiltres>

      <div
        className="grid gap-3"
        style={{
          gridTemplateColumns:
            "repeat(auto-fit, minmax(min(100%, 200px), 1fr))",
        }}
      >
        <Kpi
          label="Mandats DC"
          valeur={(data?.nombre ?? 0).toLocaleString("fr-FR")}
          sous={`${formaterSelonUnite(data?.total_dc ?? "0", unite)} ${uL}`}
        />
        <Kpi
          label="Non trouvés dans IG"
          valeur={nbNonTrouves.toLocaleString("fr-FR")}
          sous={`Écart ${formaterSelonUnite(data?.ecart ?? "0", unite)} ${uL}`}
          accent="#b45309"
          fg={nbNonTrouves > 0 ? "#b91c1c" : "#0f172a"}
        />
      </div>

      <CardShell
        title="Mandats DC"
        sub={
          data?.message ??
          (afficher === "non-trouves"
            ? "Mandats absents des règlements IG"
            : "Non trouvé surligné")
        }
      >
        {chargement ? (
          <div className="flex min-h-[160px] items-center justify-center gap-2 text-[13px] text-[#64748b]">
            <Loader2 size={16} className="animate-spin" /> Chargement…
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table
              className="w-full border-collapse"
              style={{ minWidth: 760 }}
            >
              <thead>
                <tr className="border-b border-[#e2e8f0] bg-[#f8fafc]">
                  <th className={`${thCls} text-left`}>N° émission</th>
                  <th className={`${thCls} text-left`}>Date</th>
                  <th className={`${thCls} text-left`}>Société</th>
                  <th className={`${thCls} text-right`}>Montant</th>
                  <th className={`${thCls} text-left`}>Statut</th>
                </tr>
              </thead>
              <tbody>
                {lignes.length === 0 ? (
                  <tr>
                    <td
                      colSpan={5}
                      className="px-4 py-6 text-center text-[13.5px] text-[#64748b]"
                    >
                      {data?.message ?? "Aucun mandat."}
                    </td>
                  </tr>
                ) : (
                  lignes.map((l) => (
                    <tr
                      key={l.id}
                      className="border-b border-[#eef2f4]"
                      style={{ background: l.apparie ? undefined : "#fef3c7" }}
                    >
                      <td className={tdCls} style={{ fontFamily: MONO }}>
                        {l.dc.n_emis ?? "—"}
                      </td>
                      <td className={tdCls} style={{ fontFamily: MONO }}>
                        {dateFr(l.dc.d_emis)}
                      </td>
                      <td className={tdCls}>{l.dc.nom ?? "—"}</td>
                      <td className={tdCls} style={tdMontant}>
                        {formaterSelonUnite(l.dc.montant ?? "0", unite)}
                      </td>
                      <td className={tdCls}>
                        {l.apparie ? (
                          <SofTag ton="ok">Trouvé dans IG</SofTag>
                        ) : (
                          <SofTag ton="rose">Non trouvé</SofTag>
                        )}
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
  );
}

import { useCallback, useEffect, useState } from "react";
import { Check, Loader2, Upload } from "lucide-react";
import { toast } from "sonner";
import { SofPageHeader } from "@/portails/Sof/components/layout/SofPageHeader";
import {
  CardShell,
  MONO,
  SOF_VERT,
  tdCls,
  thCls,
} from "@/portails/Sof/components/SofCards";
import {
  enregistrerLoiFinances,
  obtenirLoiFinances,
} from "@/portails/Sof/api/parametrage";
import type {
  LoiFinancesSof,
  TypeLoiFinances,
} from "@/portails/Sof/types/parametrage.interface";
import { useExerciceAnneeCourante } from "@/portails/Sof/hooks/useExerciceAnneeCourante";
import { useAuth } from "@/shared/hooks/use-auth";
import { formatMontant } from "@/shared/lib/format";

type Tab = "rec" | "dep" | "fin" | "aff";

// Modèle cible : lf_depense (MISSION…NAT + LFI + LFR côte à côte) ; ~589 lignes.
const DEP_COLS = [
  "MISSION",
  "L_MIS",
  "PROG",
  "TITRE",
  "L_TITRE",
  "BOP",
  "L_BOP",
  "L_PROG",
  "BUDGET",
  "NAT",
  "LFI",
  "LFR",
] as const;

const REF_TOTAL_LF_2025 = "5589086132451";

function videLoi(annee: number, type: TypeLoiFinances): LoiFinancesSof {
  return {
    id: null,
    exercice_annee: annee,
    type,
    libelle: `${type} ${annee}`,
    date_loi: null,
    recettes: [],
    depenses: [],
    financements: [],
    taux_affectations: [],
  };
}

export default function LoiFinances() {
  const { hasAnyRole } = useAuth();
  const estChef = hasAnyRole(["CHEF_SOF"]);
  const { annee, chargement: chargementEx } = useExerciceAnneeCourante();
  const [tab, setTab] = useState<Tab>("rec");
  const [typeLoi, setTypeLoi] = useState<TypeLoiFinances>("LFI");
  const [loi, setLoi] = useState<LoiFinancesSof | null>(null);
  const [loiAutre, setLoiAutre] = useState<LoiFinancesSof | null>(null);
  const [chargement, setChargement] = useState(false);
  const [enCours, setEnCours] = useState(false);

  const charger = useCallback(async (ex: number, type: TypeLoiFinances) => {
    setChargement(true);
    const autre: TypeLoiFinances = type === "LFI" ? "LFR" : "LFI";
    try {
      const [res, resAutre] = await Promise.all([
        obtenirLoiFinances(ex, type),
        obtenirLoiFinances(ex, autre).catch(() => ({ loi: videLoi(ex, autre) })),
      ]);
      setLoi(res.loi);
      setLoiAutre(resAutre.loi);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Chargement impossible.");
      setLoi(videLoi(ex, type));
      setLoiAutre(videLoi(ex, autre));
    } finally {
      setChargement(false);
    }
  }, []);

  useEffect(() => {
    if (annee == null) return;
    void charger(annee, typeLoi);
  }, [annee, typeLoi, charger]);

  async function controlerTotaux() {
    const total = loi?.total_depenses ?? "0";
    if (total === REF_TOTAL_LF_2025 || total === "5589086132451.00") {
      toast.success(`Total dépenses conforme : ${formatMontant(Number(total))} FCFA`);
    } else {
      toast.message(
        `Total dépenses : ${formatMontant(Number(total))} FCFA · réf. LF 2025 = ${formatMontant(Number(REF_TOTAL_LF_2025))} FCFA`,
      );
    }
  }

  async function seedExempleAffectations() {
    if (!estChef || annee == null || !loi) return;
    setEnCours(true);
    try {
      const res = await enregistrerLoiFinances(annee, typeLoi, {
        ...loi,
        taux_affectations: [
          { rubrique_code: "121", beneficiaire: "Fonds routier", nature: "TIPP", taux: "0.100000" },
          { rubrique_code: "124", beneficiaire: "CNAMGS", nature: "Redevance obligatoire", taux: "0.020000" },
          { rubrique_code: "147", beneficiaire: "CNAMGS", nature: "Taxe sur les transferts", taux: "0.100000" },
          { rubrique_code: "270", beneficiaire: "Collectivités locales", nature: "Taxe foncière", taux: "0.250000" },
          { rubrique_code: "310", beneficiaire: "Patentes", nature: "Affectation", taux: "0.074000" },
        ],
      });
      setLoi(res.loi);
      toast.success("Taux d'affectation enregistrés.");
      setTab("aff");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Enregistrement impossible.");
    } finally {
      setEnCours(false);
    }
  }

  const tabs: Array<{ id: Tab; label: string }> = [
    { id: "rec", label: `Recettes · ${loi?.recettes.length ?? 0}` },
    { id: "dep", label: `Dépenses · ${loi?.depenses.length ?? 0}` },
    { id: "fin", label: `Financements · ${loi?.financements.length ?? 0}` },
    { id: "aff", label: `Affectées · ${loi?.taux_affectations.length ?? 0}` },
  ];

  return (
    <div className="flex flex-col gap-6">
      <SofPageHeader
        title="Loi de finances (LFI / LFR)"
        description="Loi de finances initiale et rectificative, côte à côte."
        remplace="Feuille « LF » · Depenses_Budgetaires_Ordonnancement"
        actions={
          <div className="flex flex-wrap gap-2">
            {estChef ? (
              <button
                type="button"
                disabled={enCours || annee == null}
                onClick={() =>
                  toast.message(
                    "Import Excel LFI/LFR — déposer un JSON structuré via API PUT (parseur Excel à venir).",
                  )
                }
                className="inline-flex h-10 items-center gap-1.5 rounded-[10px] border border-[#e2e8f0] bg-white px-3.5 text-sm font-medium disabled:opacity-50"
              >
                <Upload className="size-4" /> Importer depuis Excel
              </button>
            ) : null}
            <button
              type="button"
              onClick={() => void controlerTotaux()}
              className="inline-flex h-10 items-center gap-1.5 rounded-[10px] px-3.5 text-sm font-semibold text-white"
              style={{
                background: `linear-gradient(180deg, ${SOF_VERT} 0%, #1e6650 100%)`,
              }}
            >
              <Check className="size-4" /> Contrôler les totaux
            </button>
          </div>
        }
      />

      <p className="rounded-[10px] border border-[#e2e8f0] bg-[#f8fafc] px-3 py-2 text-[12.5px] text-[#64748b]">
        Source : Depenses_Budgetaires_Ordonnancement › LF ; contrôle : total LF 2025 = 5
        589 086 132 451 FCFA.
        {annee != null ? ` · Exercice courant ${annee}.` : null}
      </p>

      {chargementEx || annee == null ? (
        <div className="flex min-h-[120px] items-center justify-center gap-2 text-[13px] text-[#64748b]">
          <Loader2 size={16} className="animate-spin" />
          {chargementEx ? "Chargement de l'exercice…" : "Aucun exercice ouvert."}
        </div>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-3">
            <label className="text-sm text-[#64748b]">Type de loi</label>
            <select
              value={typeLoi}
              onChange={(e) => setTypeLoi(e.target.value as TypeLoiFinances)}
              className="h-10 rounded-[10px] border border-[#e2e8f0] bg-white px-3 text-sm"
            >
              <option value="LFI">LFI {annee}</option>
              <option value="LFR">LFR {annee}</option>
            </select>
            {loi?.total_depenses ? (
              <span className="text-[13px] text-[#475569]" style={{ fontFamily: MONO }}>
                Total dépenses : {formatMontant(Number(loi.total_depenses))} FCFA
              </span>
            ) : null}
          </div>

          <div className="flex gap-1 border-b border-[#e2e8f0]">
            {tabs.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                className="px-3.5 py-2 text-[13.5px] font-medium"
                style={{
                  color: tab === t.id ? "#1e6650" : "#64748b",
                  borderBottom:
                    tab === t.id ? "2px solid #2a7f62" : "2px solid transparent",
                }}
              >
                {t.label}
              </button>
            ))}
          </div>

          {chargement || !loi ? (
            <div className="flex min-h-[160px] items-center justify-center gap-2 text-[13px] text-[#64748b]">
              <Loader2 size={16} className="animate-spin" />
              Chargement…
            </div>
          ) : tab === "rec" ? (
            <CardShell
              title="Recettes"
              sub="Codes nomenclature SROT"
            >
              {loi.recettes.length === 0 ? (
                <p className="p-4 text-sm text-[#64748b]">
                  Aucune ligne. Importer la feuille Recettes Budgétaires (pas de natures
                  inventées 711…).
                </p>
              ) : (
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="border-b border-[#e2e8f0] bg-[#f8fafc]">
                      <th className={thCls} style={{ textAlign: "left" }}>Code</th>
                      <th className={thCls} style={{ textAlign: "left" }}>Libellé</th>
                      <th className={thCls} style={{ textAlign: "right" }}>Montant</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loi.recettes.map((r) => (
                      <tr key={r.rubrique_code} className="border-b border-[#f1f5f9]">
                        <td className={tdCls} style={{ fontFamily: MONO }}>{r.rubrique_code}</td>
                        <td className={tdCls}>{r.libelle}</td>
                        <td className={tdCls} style={{ textAlign: "right", fontFamily: MONO }}>
                          {formatMontant(Number(r.montant))}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </CardShell>
          ) : tab === "dep" ? (
            <CardShell title="Dépenses" sub="Colonnes F11">
              {loi.depenses.length === 0 ? (
                <p className="p-4 text-sm text-[#64748b]">
                  Aucune ligne. Importer le fichier LF (~589 lignes).
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[1100px] border-collapse">
                    <thead>
                      <tr className="border-b border-[#e2e8f0] bg-[#f8fafc]">
                        {DEP_COLS.map((c) => (
                          <th
                            key={c}
                            className={thCls}
                            style={{
                              textAlign: c === "LFI" || c === "LFR" ? "right" : "left",
                              fontFamily: MONO,
                            }}
                          >
                            {c}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {loi.depenses.map((d, i) => {
                        const cle = [
                          d.mission,
                          d.prog,
                          d.titre,
                          d.bop,
                          d.nat,
                        ].join("|");
                        const autre = (loiAutre?.depenses ?? []).find(
                          (x) =>
                            [x.mission, x.prog, x.titre, x.bop, x.nat].join("|") ===
                            cle,
                        );
                        const montantLfi =
                          typeLoi === "LFI" ? d.montant : (autre?.montant ?? null);
                        const montantLfr =
                          typeLoi === "LFR" ? d.montant : (autre?.montant ?? null);
                        return (
                        <tr key={d.id ?? i} className="border-b border-[#f1f5f9]">
                          <td className={tdCls} style={{ fontFamily: MONO }}>{d.mission ?? "—"}</td>
                          <td className={tdCls}>{d.l_mis ?? "—"}</td>
                          <td className={tdCls} style={{ fontFamily: MONO }}>{d.prog ?? "—"}</td>
                          <td className={tdCls} style={{ fontFamily: MONO }}>{d.titre ?? "—"}</td>
                          <td className={tdCls}>{d.l_titre ?? "—"}</td>
                          <td className={tdCls} style={{ fontFamily: MONO }}>{d.bop ?? "—"}</td>
                          <td className={tdCls}>{d.l_bop ?? "—"}</td>
                          <td className={tdCls}>{d.l_prog ?? "—"}</td>
                          <td className={tdCls} style={{ fontFamily: MONO }}>{d.budget ?? "—"}</td>
                          <td className={tdCls} style={{ fontFamily: MONO }}>{d.nat ?? "—"}</td>
                          <td className={tdCls} style={{ textAlign: "right", fontFamily: MONO }}>
                            {montantLfi != null ? formatMontant(Number(montantLfi)) : "—"}
                          </td>
                          <td className={tdCls} style={{ textAlign: "right", fontFamily: MONO }}>
                            {montantLfr != null ? formatMontant(Number(montantLfr)) : "—"}
                          </td>
                        </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </CardShell>
          ) : tab === "fin" ? (
            <CardShell title="Financements" sub="Rubriques LF">
              {loi.financements.length === 0 ? (
                <p className="p-4 text-sm text-[#64748b]">
                  Aucune ligne financement.
                </p>
              ) : (
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="border-b border-[#e2e8f0] bg-[#f8fafc]">
                      <th className={thCls} style={{ textAlign: "left" }}>Code</th>
                      <th className={thCls} style={{ textAlign: "left" }}>Libellé</th>
                      <th className={thCls} style={{ textAlign: "right" }}>Montant</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loi.financements.map((f) => (
                      <tr key={f.code} className="border-b border-[#f1f5f9]">
                        <td className={tdCls} style={{ fontFamily: MONO }}>{f.code}</td>
                        <td className={tdCls}>{f.libelle}</td>
                        <td className={tdCls} style={{ textAlign: "right", fontFamily: MONO }}>
                          {formatMontant(Number(f.montant))}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </CardShell>
          ) : (
            <CardShell title="Recettes affectées" sub="Taux en % · stockés en décimal">
              {loi.taux_affectations.length === 0 ? (
                <div className="flex flex-col gap-3 p-4">
                  <p className="text-sm text-[#64748b]">Aucune affectation enregistrée.</p>
                  {estChef ? (
                    <button
                      type="button"
                      disabled={enCours}
                      onClick={() => void seedExempleAffectations()}
                      className="inline-flex h-9 w-fit items-center rounded-md border border-[#cbd5e1] bg-white px-3 text-[13px] font-semibold text-[#0f172a] disabled:opacity-50"
                    >
                      Charger les taux de référence (exemple)
                    </button>
                  ) : null}
                </div>
              ) : (
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="border-b border-[#e2e8f0] bg-[#f8fafc]">
                      <th className={thCls} style={{ textAlign: "left" }}>Code rubrique</th>
                      <th className={thCls} style={{ textAlign: "left" }}>Bénéficiaire</th>
                      <th className={thCls} style={{ textAlign: "left" }}>Nature</th>
                      <th className={thCls} style={{ textAlign: "right" }}>Taux</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loi.taux_affectations.map((x) => (
                      <tr key={x.rubrique_code + x.nature} className="border-b border-[#f1f5f9]">
                        <td className={tdCls} style={{ fontFamily: MONO }}>{x.rubrique_code}</td>
                        <td className={tdCls} style={{ fontWeight: 500 }}>{x.beneficiaire}</td>
                        <td className={tdCls}>{x.nature}</td>
                        <td className={tdCls} style={{ textAlign: "right", fontFamily: MONO }}>
                          {(Number(x.taux) * 100).toLocaleString("fr-FR", {
                            maximumFractionDigits: 1,
                          })}{" "}
                          %
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </CardShell>
          )}
        </>
      )}
    </div>
  );
}

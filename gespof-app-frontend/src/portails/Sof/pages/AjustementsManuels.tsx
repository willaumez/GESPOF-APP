import { useEffect, useMemo, useState } from "react";
import { Loader2, Plus } from "lucide-react";
import { toast } from "sonner";
import { SofPageHeader } from "@/portails/Sof/components/layout/SofPageHeader";
import {
  CardShell,
  MONO,
  SofBarreFiltres,
  SofPeriodeSelect,
  tdCls,
  thCls,
  usePeriodesSof,
} from "@/portails/Sof/components/SofCards";
import {
  contrePasserAjustement,
  creerAjustement,
  listerAjustements,
  listerNomenclatureAjustements,
  type CodeAjustementNomenclature,
  type NatureAjustement,
  type OperationAjustement,
} from "@/portails/Sof/api/ajustements";
import { formatMontant } from "@/shared/lib/format";
import { useAuth } from "@/shared/hooks/use-auth";

function dateFr(iso: string): string {
  const [y, m, d] = iso.split("-");
  if (!y || !m || !d) return iso;
  return `${d}/${m}/${y}`;
}

/**
 * Ajustements manuels — SPEC §7 (insertion + contre-passation, pas de suppression).
 */
export default function AjustementsManuels() {
  const { hasAnyRole } = useAuth();
  const peutEcrire = hasAnyRole(["AGENT_SOF", "CHEF_SOF"]);
  const { periodes, periodeId, setPeriodeId } = usePeriodesSof();

  const [ops, setOps] = useState<OperationAjustement[]>([]);
  const [verrouillee, setVerrouillee] = useState(false);
  const [chargement, setChargement] = useState(false);
  const [enCours, setEnCours] = useState(false);

  const [nature, setNature] = useState<NatureAjustement>("DEPENSE");
  const [codes, setCodes] = useState<CodeAjustementNomenclature[]>([]);
  const [codeAj, setCodeAj] = useState("");
  const [montant, setMontant] = useState("");
  const [motif, setMotif] = useState("");

  async function recharger() {
    if (periodeId === "") return;
    setChargement(true);
    try {
      const data = await listerAjustements(Number(periodeId));
      setOps(data.operations ?? []);
      setVerrouillee(Boolean(data.verrouillee));
      if (data.message) toast.message(data.message);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Chargement impossible.");
    } finally {
      setChargement(false);
    }
  }

  useEffect(() => {
    void recharger();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [periodeId]);

  useEffect(() => {
    listerNomenclatureAjustements(nature)
      .then((r) => {
        const liste = r.nomenclature[nature] ?? [];
        setCodes(liste.filter((c) => c.code_srot));
        setCodeAj("");
      })
      .catch(() => setCodes([]));
  }, [nature]);

  const codeSelectionne = useMemo(
    () => codes.find((c) => c.code === codeAj) ?? null,
    [codes, codeAj],
  );

  async function ajouter() {
    if (!peutEcrire || verrouillee || periodeId === "") return;
    if (!codeAj || !montant.trim() || !motif.trim()) {
      toast.error("Nature, code, montant et motif sont obligatoires.");
      return;
    }
    setEnCours(true);
    try {
      await creerAjustement({
        periode_id: Number(periodeId),
        nature,
        code_ajustement: codeAj,
        montant: montant.replace(/\s/g, "").replace(",", "."),
        motif: motif.trim(),
      });
      toast.success("Ajustement enregistré.");
      setMontant("");
      setMotif("");
      await recharger();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Enregistrement impossible.");
    } finally {
      setEnCours(false);
    }
  }

  async function contrePasser(a: OperationAjustement) {
    if (!peutEcrire || verrouillee) return;
    const m = window.prompt(
      "Motif de contre-passation",
      `Contre-passation de ${a.reference}`,
    );
    if (!m) return;
    setEnCours(true);
    try {
      await contrePasserAjustement(a.id, m);
      toast.success("Contre-passation enregistrée.");
      await recharger();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Contre-passation impossible.");
    } finally {
      setEnCours(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <SofPageHeader
        title="Ajustements manuels"
        description="Corrections signées sur la SROT. Pas de suppression : uniquement contre-passation. Impact code SROT via nomenclature."
        remplace="RD Ajustements Manuels.xlsm · SPEC §7"
      />

      <SofBarreFiltres>
        <SofPeriodeSelect
          periodes={periodes}
          value={periodeId}
          onChange={setPeriodeId}
        />
        {verrouillee ? (
          <span className="text-[13px] font-medium text-[#b45309]">
            Période verrouillée — saisie refusée
          </span>
        ) : null}
      </SofBarreFiltres>

      {peutEcrire && !verrouillee ? (
        <CardShell title="Nouvel ajustement" sub="Cascade nomenclature · montant FCFA signé">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <label className="flex flex-col gap-1 text-[11px] font-semibold tracking-[0.06em] text-[#64748b] uppercase">
              Nature
              <select
                value={nature}
                onChange={(e) => setNature(e.target.value as NatureAjustement)}
                className="h-[38px] rounded-md border border-[#cbd5e1] bg-white px-2.5 text-[13px] font-normal normal-case text-[#0f172a]"
              >
                <option value="DEPENSE">Dépense</option>
                <option value="RECETTE">Recette</option>
              </select>
            </label>
            <label className="flex flex-col gap-1 text-[11px] font-semibold tracking-[0.06em] text-[#64748b] uppercase sm:col-span-2">
              Code ajustement
              <select
                value={codeAj}
                onChange={(e) => setCodeAj(e.target.value)}
                className="h-[38px] rounded-md border border-[#cbd5e1] bg-white px-2.5 text-[13px] font-normal normal-case text-[#0f172a]"
              >
                <option value="">— choisir —</option>
                {codes.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.code} · {c.libelle}
                    {c.code_srot ? ` → ${c.code_srot}` : ""}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-[11px] font-semibold tracking-[0.06em] text-[#64748b] uppercase">
              Montant (FCFA)
              <input
                value={montant}
                onChange={(e) => setMontant(e.target.value)}
                placeholder="ex. -1500000"
                className="h-[38px] rounded-md border border-[#cbd5e1] bg-white px-2.5 text-[13px] font-normal normal-case"
                style={{ fontFamily: MONO }}
              />
            </label>
            <label className="flex flex-col gap-1 text-[11px] font-semibold tracking-[0.06em] text-[#64748b] uppercase sm:col-span-2 lg:col-span-3">
              Motif
              <input
                value={motif}
                onChange={(e) => setMotif(e.target.value)}
                className="h-[38px] rounded-md border border-[#cbd5e1] bg-white px-2.5 text-[13px] font-normal normal-case"
              />
            </label>
            <div className="flex items-end">
              <button
                type="button"
                disabled={enCours}
                onClick={() => void ajouter()}
                className="inline-flex h-[38px] items-center gap-2 rounded-md border px-3.5 text-[13.5px] font-semibold text-white disabled:opacity-50"
                style={{ background: "#2a7f62", borderColor: "#2a7f62" }}
              >
                {enCours ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <Plus size={16} />
                )}
                Enregistrer
              </button>
            </div>
          </div>
          {codeSelectionne ? (
            <p className="mt-2 text-[12.5px] text-[#64748b]">
              SROT impacté :{" "}
              <span style={{ fontFamily: MONO, fontWeight: 600 }}>
                {codeSelectionne.code_srot ?? "—"}
              </span>
            </p>
          ) : null}
        </CardShell>
      ) : null}

      <CardShell
        title="Ajustements de la période"
        sub={`${ops.length} opérations`}
      >
        {chargement ? (
          <div className="flex min-h-[120px] items-center justify-center gap-2 text-[13px] text-[#64748b]">
            <Loader2 size={16} className="animate-spin" /> Chargement…
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] border-collapse">
              <thead>
                <tr className="border-b border-[#e2e8f0] bg-[#f8fafc]">
                  <th className={thCls} style={{ textAlign: "left" }}>
                    Réf.
                  </th>
                  <th className={thCls} style={{ textAlign: "left" }}>
                    Date
                  </th>
                  <th className={thCls} style={{ textAlign: "left" }}>
                    Nature
                  </th>
                  <th className={thCls} style={{ textAlign: "left" }}>
                    Code
                  </th>
                  <th className={thCls} style={{ textAlign: "left" }}>
                    SROT
                  </th>
                  <th className={thCls} style={{ textAlign: "right" }}>
                    Montant
                  </th>
                  <th className={thCls} style={{ textAlign: "left" }}>
                    Motif
                  </th>
                  <th className={thCls} />
                </tr>
              </thead>
              <tbody>
                {ops.length === 0 ? (
                  <tr>
                    <td
                      colSpan={8}
                      className={`${tdCls} text-center text-[#64748b]`}
                    >
                      Aucun ajustement.
                    </td>
                  </tr>
                ) : (
                  ops.map((a) => (
                    <tr key={a.id} className="border-b border-[#f1f5f9]">
                      <td className={tdCls} style={{ fontFamily: MONO }}>
                        {a.reference}
                      </td>
                      <td className={tdCls} style={{ fontFamily: MONO }}>
                        {dateFr(a.date)}
                      </td>
                      <td className={tdCls}>{a.nature_libelle}</td>
                      <td className={tdCls} style={{ fontFamily: MONO }}>
                        {a.code_ajustement}
                      </td>
                      <td className={tdCls} style={{ fontFamily: MONO }}>
                        {a.code_srot ?? "—"}
                      </td>
                      <td
                        className={tdCls}
                        style={{
                          textAlign: "right",
                          fontFamily: MONO,
                          color:
                            Number(a.montant) < 0 ? "#b45309" : undefined,
                        }}
                      >
                        {formatMontant(Number(a.montant))}
                      </td>
                      <td className={tdCls}>{a.motif}</td>
                      <td className={tdCls} style={{ textAlign: "right" }}>
                        {peutEcrire &&
                        !verrouillee &&
                        !a.contre_passation_de_id ? (
                          <button
                            type="button"
                            disabled={enCours}
                            onClick={() => void contrePasser(a)}
                            className="h-7 rounded-[5px] border border-[#e2e8f0] bg-white px-2.5 text-xs font-semibold text-[#334155]"
                          >
                            Contre-passer
                          </button>
                        ) : a.contre_passation_de_id ? (
                          <span className="text-[11px] text-[#64748b]">CP</span>
                        ) : null}
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

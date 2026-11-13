import { useEffect, useState } from "react";
import { Loader2, Save } from "lucide-react";
import { toast } from "sonner";
import { SofPageHeader } from "@/portails/Sof/components/layout/SofPageHeader";
import {
  CardShell,
  MONO,
  tdCls,
  thCls,
} from "@/portails/Sof/components/SofCards";
import {
  enregistrerFicheDepots,
  listerFicheDepots,
  type LigneFicheDepot,
} from "@/portails/Sof/api/srot";
import { usePeriode } from "@/portails/Sof/hooks/PeriodeContext";
import { useAuth } from "@/shared/hooks/use-auth";
import { formatMontant } from "@/shared/lib/format";

export default function Page() {
  const { periodeSof } = usePeriode();
  const { hasAnyRole } = useAuth();
  const peutSaisir = hasAnyRole(["CHEF_SOF"]);
  const [lignes, setLignes] = useState<LigneFicheDepot[]>([]);
  const [exercice, setExercice] = useState<number | null>(null);
  const [totaux, setTotaux] = useState({
    montant_01_01: "0",
    montant_situation: "0",
  });
  const [chargement, setChargement] = useState(true);
  const [enCours, setEnCours] = useState(false);
  const [brouillon, setBrouillon] = useState<
    Record<string, { m01: string; msit: string }>
  >({});

  async function charger() {
    setChargement(true);
    try {
      const data = await listerFicheDepots(periodeSof?.id ?? null);
      setLignes(data.lignes);
      setExercice(data.exercice);
      setTotaux(data.totaux);
      const b: Record<string, { m01: string; msit: string }> = {};
      for (const l of data.lignes) {
        b[l.code] = {
          m01: l.montant_01_01,
          msit: l.montant_situation,
        };
      }
      setBrouillon(b);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Chargement impossible.");
      setLignes([]);
    } finally {
      setChargement(false);
    }
  }

  useEffect(() => {
    void charger();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [periodeSof?.id]);

  async function sauver() {
    if (!peutSaisir || exercice == null) return;
    setEnCours(true);
    try {
      const data = await enregistrerFicheDepots({
        exercice,
        lignes: lignes.map((l) => ({
          code: l.code,
          montant_01_01: (brouillon[l.code]?.m01 ?? l.montant_01_01)
            .replace(/\s/g, "")
            .replace(",", "."),
          montant_situation: (brouillon[l.code]?.msit ?? l.montant_situation)
            .replace(/\s/g, "")
            .replace(",", "."),
        })),
      });
      setLignes(data.lignes);
      setTotaux(data.totaux);
      toast.success("Fiche de dépôts enregistrée.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Enregistrement impossible.");
    } finally {
      setEnCours(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <SofPageHeader
        title="Fiche de dépôts (CUT)"
        description="Position des dépôts du compte unique du Trésor. Saisie Chef SOF (SPEC §8.3)."
        remplace="Fiche de dépôts · srot-depots"
        actions={
          peutSaisir ? (
            <button
              type="button"
              disabled={enCours || chargement}
              onClick={() => void sauver()}
              className="inline-flex h-10 items-center gap-1.5 rounded-[10px] border px-3.5 text-sm font-semibold text-white disabled:opacity-50"
              style={{ background: "#2a7f62", borderColor: "#2a7f62" }}
            >
              {enCours ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <Save size={16} />
              )}
              Enregistrer
            </button>
          ) : undefined
        }
      />

      <CardShell
        title="Fiche de dépôts (CUT)"
        sub={
          exercice
            ? `Exercice ${exercice} · ${lignes.length} lignes`
            : undefined
        }
      >
        {chargement ? (
          <div className="flex min-h-[160px] items-center justify-center gap-2 text-[13px] text-[#64748b]">
            <Loader2 size={16} className="animate-spin" /> Chargement…
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] border-collapse">
              <thead>
                <tr className="border-b border-[#e2e8f0] bg-[#f8fafc]">
                  <th className={thCls} style={{ textAlign: "left" }}>
                    Domiciliation
                  </th>
                  <th className={thCls} style={{ textAlign: "left" }}>
                    Libellé
                  </th>
                  <th className={thCls} style={{ textAlign: "left" }}>
                    Devise
                  </th>
                  <th className={thCls} style={{ textAlign: "right" }}>
                    Au 01/01
                  </th>
                  <th className={thCls} style={{ textAlign: "right" }}>
                    À la situation
                  </th>
                </tr>
              </thead>
              <tbody>
                {lignes.map((l) => (
                  <tr key={l.code} className="border-b border-[#f1f5f9]">
                    <td className={tdCls}>{l.domiciliation ?? "—"}</td>
                    <td className={tdCls}>{l.libelle}</td>
                    <td className={tdCls} style={{ fontFamily: MONO }}>
                      {l.devise}
                    </td>
                    <td className={tdCls} style={{ textAlign: "right" }}>
                      {peutSaisir ? (
                        <input
                          value={brouillon[l.code]?.m01 ?? l.montant_01_01}
                          onChange={(e) =>
                            setBrouillon((prev) => ({
                              ...prev,
                              [l.code]: {
                                m01: e.target.value,
                                msit:
                                  prev[l.code]?.msit ?? l.montant_situation,
                              },
                            }))
                          }
                          className="h-8 w-[140px] rounded border border-[#e2e8f0] px-2 text-right text-[13px]"
                          style={{ fontFamily: MONO }}
                        />
                      ) : (
                        <span style={{ fontFamily: MONO }}>
                          {formatMontant(Number(l.montant_01_01))}
                        </span>
                      )}
                    </td>
                    <td className={tdCls} style={{ textAlign: "right" }}>
                      {peutSaisir ? (
                        <input
                          value={brouillon[l.code]?.msit ?? l.montant_situation}
                          onChange={(e) =>
                            setBrouillon((prev) => ({
                              ...prev,
                              [l.code]: {
                                m01: prev[l.code]?.m01 ?? l.montant_01_01,
                                msit: e.target.value,
                              },
                            }))
                          }
                          className="h-8 w-[140px] rounded border border-[#e2e8f0] px-2 text-right text-[13px]"
                          style={{ fontFamily: MONO }}
                        />
                      ) : (
                        <span style={{ fontFamily: MONO }}>
                          {formatMontant(Number(l.montant_situation))}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
                <tr className="bg-[#f0f7f4]">
                  <td className={tdCls} style={{ fontWeight: 600 }} colSpan={3}>
                    Total
                  </td>
                  <td
                    className={tdCls}
                    style={{
                      textAlign: "right",
                      fontFamily: MONO,
                      fontWeight: 600,
                    }}
                  >
                    {formatMontant(Number(totaux.montant_01_01))}
                  </td>
                  <td
                    className={tdCls}
                    style={{
                      textAlign: "right",
                      fontFamily: MONO,
                      fontWeight: 600,
                    }}
                  >
                    {formatMontant(Number(totaux.montant_situation))}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </CardShell>
    </div>
  );
}

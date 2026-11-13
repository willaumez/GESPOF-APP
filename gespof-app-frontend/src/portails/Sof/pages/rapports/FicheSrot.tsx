import { useEffect, useState } from "react";
import { FileDown, Loader2, Save } from "lucide-react";
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
  enregistrerCommentairesFiche,
  obtenirFicheSrot,
  telechargerFicheSrot,
} from "@/portails/Sof/api/rapports";
import { usePeriode } from "@/portails/Sof/hooks/PeriodeContext";
import { formatMontant } from "@/shared/lib/format";

const CLE_COM = [
  { cle: "commentaire_recettes", label: "Commentaire recettes" },
  { cle: "commentaire_depenses", label: "Commentaire dépenses" },
  { cle: "commentaire_financement", label: "Commentaire financement" },
] as const;

export default function Page() {
  const { periodeSof } = usePeriode();
  const [variables, setVariables] = useState<
    Array<{ nom: string; valeur: string; source: string }>
  >([]);
  const [coms, setComs] = useState<Record<string, string>>({});
  const [periodeId, setPeriodeId] = useState<number | null>(null);
  const [chargement, setChargement] = useState(true);
  const [enCours, setEnCours] = useState(false);

  async function charger() {
    setChargement(true);
    try {
      const data = await obtenirFicheSrot(periodeSof?.id ?? null);
      setVariables(data.variables);
      setComs(data.commentaires ?? {});
      setPeriodeId(data.periode.id);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Chargement impossible.");
    } finally {
      setChargement(false);
    }
  }

  useEffect(() => {
    void charger();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [periodeSof?.id]);

  async function sauver() {
    if (!periodeId) return;
    setEnCours(true);
    try {
      await enregistrerCommentairesFiche({
        periode_id: periodeId,
        commentaires: coms,
      });
      toast.success("Commentaires enregistrés.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Enregistrement impossible.");
    } finally {
      setEnCours(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <SofPageHeader
        title="Fiche SROT (MBCP)"
        description="Variables calculées depuis la SROT ; commentaires et export HTML/PDF."
        remplace="Methods.rapportSROT · SPEC §11"
        actions={
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={enCours}
              onClick={() => void sauver()}
              className="inline-flex h-10 items-center gap-1.5 rounded-[10px] border border-[#e2e8f0] bg-white px-3.5 text-sm font-medium disabled:opacity-50"
            >
              <Save className="size-4" /> Enregistrer
            </button>
            <button
              type="button"
              onClick={() =>
                void telechargerFicheSrot(periodeSof?.id).then(() =>
                  toast.success("Fiche HTML téléchargée."),
                )
              }
              className="inline-flex h-10 items-center gap-1.5 rounded-[10px] px-3.5 text-sm font-semibold text-white"
              style={{
                background: `linear-gradient(180deg, ${SOF_VERT} 0%, #1e6650 100%)`,
              }}
            >
              <FileDown className="size-4" /> Export PDF
            </button>
          </div>
        }
      />

      {chargement ? (
        <div className="flex min-h-[160px] items-center justify-center gap-2 text-[13px] text-[#64748b]">
          <Loader2 size={16} className="animate-spin" /> Chargement…
        </div>
      ) : (
        <>
          <CardShell
            title="Valeurs calculées"
            sub="Alimentées par l'équilibre · lecture seule"
          >
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b border-[#e2e8f0] bg-[#f8fafc]">
                  <th className={thCls} style={{ textAlign: "left" }}>
                    Nom
                  </th>
                  <th className={thCls} style={{ textAlign: "right" }}>
                    Valeur
                  </th>
                </tr>
              </thead>
              <tbody>
                {variables.map((v) => (
                  <tr key={v.nom} className="border-b border-[#f1f5f9]">
                    <td className={tdCls} style={{ fontFamily: MONO }}>
                      {v.nom}
                    </td>
                    <td
                      className={tdCls}
                      style={{ textAlign: "right", fontFamily: MONO }}
                    >
                      {formatMontant(Number(v.valeur))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardShell>

          <CardShell title="Commentaires" sub="Rédaction libre">
            <div className="flex flex-col gap-3 p-1">
              {CLE_COM.map((c) => (
                <label
                  key={c.cle}
                  className="flex flex-col gap-1 text-[11px] font-semibold tracking-[0.06em] text-[#64748b] uppercase"
                >
                  {c.label}
                  <textarea
                    value={coms[c.cle] ?? ""}
                    onChange={(e) =>
                      setComs((prev) => ({ ...prev, [c.cle]: e.target.value }))
                    }
                    rows={3}
                    className="rounded-md border border-[#cbd5e1] bg-white px-3 py-2 text-[13px] font-normal normal-case text-[#0f172a]"
                  />
                </label>
              ))}
            </div>
          </CardShell>
        </>
      )}
    </div>
  );
}

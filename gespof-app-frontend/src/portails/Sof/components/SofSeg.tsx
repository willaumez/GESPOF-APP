type Opt = { cle: string; libelle: string };

type Props = {
  label: string;
  options: Opt[];
  value: string;
  onChange: (cle: string) => void;
};

/** Segment pills (maquette SOF — X.seg / unitSeg). */
export function SofSeg({ label, options, value, onChange }: Props) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-[11px] font-semibold tracking-[0.06em] text-[#64748b] uppercase">
        {label}
      </span>
      <div className="flex rounded-md border border-[#cbd5e1] bg-[#f8fafc] p-0.5">
        {options.map((opt) => {
          const on = value === opt.cle;
          return (
            <button
              key={opt.cle}
              type="button"
              onClick={() => onChange(opt.cle)}
              className="h-7 rounded px-2.5 text-[12.5px] font-semibold"
              style={{
                background: on ? "#fff" : "transparent",
                color: on ? "#1e6650" : "#475569",
                boxShadow: on ? "0 1px 2px rgba(15,23,42,.15)" : "none",
              }}
            >
              {opt.libelle}
            </button>
          );
        })}
      </div>
    </div>
  );
}

import { ArrowRight, Loader2 } from "lucide-react";

export function BoutonSoumission({
  loading,
  label,
}: {
  loading: boolean;
  label: string;
}) {
  return (
    <button
      type="submit"
      disabled={loading}
      className="flex h-[3.125rem] w-full cursor-pointer items-center justify-center gap-[0.625rem] rounded-[0.625rem] border-none text-[0.9375rem] font-semibold tracking-[.02em] text-white shadow-[0_6px_20px_rgba(15,23,42,.20)] transition-[box-shadow,transform,opacity] duration-200 hover:-translate-y-px hover:shadow-[0_10px_28px_rgba(15,23,42,.30)] active:translate-y-0 disabled:opacity-70 disabled:cursor-not-allowed"
      style={{ background: "linear-gradient(180deg,#1e4d8c 0%,#0f172a 100%)" }}
    >
      {loading ? (
        <Loader2 size={18} className="animate-spin" />
      ) : (
        <>
          {label}
          <ArrowRight size={17} strokeWidth={2.2} />
        </>
      )}
    </button>
  );
}

import { ArrowRight, Loader2 } from "lucide-react";

/**
 * Bouton principal des formulaires d'auth.
 * Pas de translate au survol : un lift déplace le bord sous le curseur et
 * provoque un tremblement (entrer/sortir du :hover en boucle).
 */
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
      className="group relative flex h-12 w-full cursor-pointer items-center justify-center gap-2.5 overflow-hidden rounded-xl border border-white/10 text-[0.9375rem] font-semibold tracking-[0.02em] text-white shadow-[0_1px_0_rgba(255,255,255,0.12)_inset,0_8px_24px_rgba(15,23,42,0.28)] transition-[box-shadow,filter,opacity] duration-200 ease-out hover:shadow-[0_1px_0_rgba(255,255,255,0.18)_inset,0_12px_32px_rgba(30,77,140,0.45)] hover:brightness-[1.06] active:brightness-95 active:shadow-[0_1px_0_rgba(255,255,255,0.08)_inset,0_4px_14px_rgba(15,23,42,0.28)] disabled:cursor-not-allowed disabled:opacity-70 disabled:hover:brightness-100 sm:h-[3.125rem]"
      style={{
        background: "linear-gradient(165deg, #2a5f9e 0%, #1e4d8c 42%, #0f172a 100%)",
      }}
    >
      <span
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/35 to-transparent"
      />
      {loading ? (
        <Loader2 size={18} className="animate-spin" aria-hidden />
      ) : (
        <>
          {label}
          <ArrowRight
            size={17}
            strokeWidth={2.2}
            aria-hidden
            className="transition-transform duration-200 ease-out group-hover:translate-x-0.5 motion-reduce:transition-none motion-reduce:group-hover:translate-x-0"
          />
        </>
      )}
    </button>
  );
}

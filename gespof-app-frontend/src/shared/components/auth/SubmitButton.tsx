import { ArrowRight, Loader2 } from "lucide-react";

/** Bouton primaire — gradient / typo maquette Prototype v2. */
export function BoutonSoumission({
  loading,
  label,
  loadingLabel = "Connexion en cours…",
}: {
  loading: boolean;
  label: string;
  loadingLabel?: string;
}) {
  return (
    <button type="submit" disabled={loading} className="am-submit">
      {loading ? (
        <span style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <Loader2 size={18} className="animate-spin" aria-hidden />
          {loadingLabel}
        </span>
      ) : (
        <span style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {label}
          <ArrowRight size={17} strokeWidth={2} aria-hidden />
        </span>
      )}
    </button>
  );
}

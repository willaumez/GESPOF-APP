import { useNavigate, Navigate } from "react-router-dom";
import { ArrowRight, LogOut } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/shared/hooks/use-auth";
import type { Portail, RoleUtilisateur } from "@/shared/hooks/auth-context";
import { getAccessiblePortails } from "@/shared/config/menu";
import type { MenuPortal } from "@/shared/types/menu.interface";

const LOGO_GESPOF = "/GESPOF-logo.png";

/** Couleurs texte CTA / badge — maquette Prototype v2 (TH.tx / TH.ib). */
const THEME_CARD: Record<
  Portail,
  { tx: string; ib: string }
> = {
  sof: { tx: "#1e6650", ib: "#e3f1ea" },
  sp: { tx: "#7f5d05", ib: "#fbf1d6" },
  sr: { tx: "#064A85", ib: "#D6E2F5" },
  admin: { tx: "#0f172a", ib: "#e2e8f0" },
};

/** Modules affichés sous la description — libellés maquette. */
const HIGHLIGHTS: Record<Portail, string[]> = {
  sof: [
    "SROT — Recettes, TVA et Dépenses",
    "Restitutions et analyses des règlements",
    "Référentiels budgétaires et comptables",
  ],
  sp: [
    "Fiche matinale, Fiche Bleue, Fiche des dépôts",
    "Rapprochement des recettes et des dépenses",
    "Journées de trésorerie et consolidation",
  ],
  sr: [
    "Génération des fiches Systac, Sigma, Numéraire",
    "Transmission au Service de Prévision",
    "Liste et historique des fiches",
  ],
  admin: [
    "Comptes et habilitations",
    "Audit des connexions",
    "Audit d'actions",
  ],
};

const ROLE_LABEL: Partial<Record<RoleUtilisateur, string>> = {
  ADMINISTRATEUR: "ADMINISTRATEUR",
  AGENT_SOF: "AGENT SOF",
  CHEF_SOF: "CHEF SOF",
  AGENT_SP: "AGENT SP",
  CHEF_SP: "CHEF SP",
  AGENT_SR: "AGENT SR",
  CHEF_SR: "CHEF SR",
  DIRECTEUR_DOMF: "DIRECTEUR DOMF",
  DIRECTION_DG: "DIRECTION DG",
  SUPERVISEUR: "SUPERVISEUR",
};

function formaterDerniereConnexion(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const date = d.toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
  const heure = d.toLocaleTimeString("fr-FR", {
    hour: "2-digit",
    minute: "2-digit",
  });
  return `Dernière connexion le ${date} à ${heure}`;
}

function PortailCard({
  portail,
  index,
  onSelect,
}: {
  portail: MenuPortal;
  index: number;
  onSelect: () => void;
}) {
  const accent = portail.theme.topColor;
  const { tx, ib } = THEME_CARD[portail.id];
  const mods = HIGHLIGHTS[portail.id];
  const showBadge = Boolean(portail.badge);

  return (
    <button
      type="button"
      onClick={onSelect}
      aria-label={`${portail.ctaLabel} — ${portail.subtitle}`}
      className="group flex min-h-[340px] flex-col overflow-hidden rounded-lg border border-[#e2e8f0] bg-white text-left outline-none transition-[box-shadow,border-color] duration-150 hover:shadow-[0_12px_28px_-8px_rgba(15,23,42,.14)] focus-visible:ring-2 focus-visible:ring-offset-2"
      style={{
        borderTop: `4px solid ${accent}`,
        animation: `popIn 0.45s ease ${0.1 + index * 0.06}s both`,
        ["--tw-ring-color" as string]: accent,
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = accent;
        e.currentTarget.style.borderTopColor = accent;
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = "#e2e8f0";
        e.currentTarget.style.borderTopColor = accent;
      }}
    >
      <div className="flex flex-1 flex-col gap-[18px] px-6 pb-5 pt-6">
        <div className="flex min-h-[52px] items-start justify-between gap-2">
          {portail.logo ? (
            <img
              src={portail.logo}
              alt={portail.subtitle}
              className="h-[46px] min-w-0 max-w-full flex-1 object-contain object-left-top"
            />
          ) : (
            <div className="flex flex-col gap-0.5">
              <span
                className="font-serif text-2xl font-semibold leading-[1.1]"
                style={{
                  fontFamily: '"IBM Plex Serif", "IBM Plex Sans", serif',
                  color: tx,
                }}
              >
                Administration
              </span>
              <span
                className="text-[9.5px] tracking-[0.2em]"
                style={{ color: tx }}
              >
                DOMF · DGCPT
              </span>
            </div>
          )}
          {showBadge ? (
            <span
              className="shrink-0 rounded px-2 py-[3px] text-[10.5px] font-semibold tracking-[0.08em]"
              style={{ background: ib, color: tx }}
            >
              {portail.badge}
            </span>
          ) : null}
        </div>

        <p className="text-[14.5px] leading-[1.55] text-[#334155]">
          {portail.description}
        </p>

        <div className="flex flex-col gap-2 border-t border-[#f1f5f9] pt-[14px]">
          {mods.map((m) => (
            <div
              key={m}
              className="flex items-center gap-2.5 text-[13px] text-[#475569]"
            >
              <span
                className="size-[5px] shrink-0"
                style={{ background: accent }}
              />
              {m}
            </div>
          ))}
        </div>
      </div>

      <div
        className="flex items-center justify-between rounded-b-lg border-t border-[#e2e8f0] px-6 py-[14px] text-sm font-semibold"
        style={{ background: portail.theme.bgColor, color: tx }}
      >
        {portail.ctaLabel}
        <ArrowRight
          size={16}
          strokeWidth={2.2}
          className="transition-transform duration-150 group-hover:translate-x-0.5"
          aria-hidden
        />
      </div>
    </button>
  );
}

const PortailSelection = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const accessiblePortails = getAccessiblePortails(user?.roles ?? []);

  if (accessiblePortails.length === 1) {
    return <Navigate to={accessiblePortails[0].path} replace />;
  }

  const nomComplet = user
    ? `${user.nom ?? ""} ${user.prenom ?? ""}`.trim()
    : "";
  const nomAffiche = nomComplet || "Utilisateur";

  const initiales = user
    ? `${user.nom?.[0] ?? ""}${user.prenom?.[0] ?? ""}`.toUpperCase() || "??"
    : "??";

  const rolePrincipal = user?.roles[0];
  const roleLabel =
    (rolePrincipal && ROLE_LABEL[rolePrincipal]) ||
    rolePrincipal ||
    "UTILISATEUR";

  const derniere = formaterDerniereConnexion(user?.derniereConnexion ?? null);

  const handleLogout = () => {
    toast.success("Vous avez été déconnecté.");
    void logout().then(() => navigate("/"));
  };

  return (
    <div className="flex min-h-screen flex-col bg-[#f8fafc] font-sans">
      {/* Header maquette */}
      <header
        className="flex shrink-0 items-center gap-3.5 bg-white px-5 sm:px-8"
        style={{ height: 68 }}
      >
        <img
          src={LOGO_GESPOF}
          alt=""
          className="size-10 shrink-0 object-contain"
        />
        <div className="flex min-w-0 flex-1 flex-col leading-[1.2]">
          <span
            className="text-[18px] font-semibold text-[#0f172a]"
            style={{ fontFamily: '"IBM Plex Serif", "IBM Plex Sans", serif' }}
          >
            GESPOF
          </span>
          <span className="text-[11px] uppercase tracking-[0.14em] text-[#64748b]">
            Portail des services
          </span>
        </div>

        <div className="hidden items-center gap-2.5 sm:flex">
          <div className="grid size-9 place-items-center rounded-md bg-[#0f172a] text-[13px] font-semibold text-white">
            {initiales}
          </div>
          <div className="flex min-w-0 flex-col leading-[1.25]">
            <span className="truncate text-sm font-semibold text-[#0f172a]">
              {nomAffiche}
            </span>
            <span className="text-[11px] tracking-[0.06em] text-[#64748b]">
              {roleLabel}
            </span>
          </div>
        </div>

        <button
          type="button"
          onClick={handleLogout}
          className="ml-1 flex h-9 items-center gap-2 rounded-md border border-[#fecaca] bg-white px-3 text-[13px] text-[#b91c1c] transition-colors hover:bg-[#fef2f2] sm:ml-3"
        >
          <LogOut size={15} strokeWidth={1.8} aria-hidden />
          <span className="hidden sm:inline">Déconnexion</span>
        </button>
      </header>

      <div className="flex h-[3px] w-full shrink-0" aria-hidden>
        <span className="flex-1 bg-[#2a7f62]" />
        <span className="flex-1 bg-[#c9960a]" />
        <span className="flex-1 bg-[#064A85]" />
      </div>

      <main className="mx-auto flex w-full max-w-[1240px] flex-1 flex-col gap-9 px-5 py-10 sm:px-8 sm:py-14">
        <div className="flex flex-wrap items-end justify-between gap-5">
          <div className="flex flex-col gap-2.5">
            <div className="text-sm text-[#475569]">
              Bienvenue,{" "}
              <b className="font-semibold text-[#0f172a]">{nomAffiche}</b>
            </div>
            <h1
              className="m-0 text-[28px] font-semibold tracking-[-0.01em] text-[#0f172a] sm:text-[38px]"
              style={{
                fontFamily: '"IBM Plex Serif", "IBM Plex Sans", serif',
                lineHeight: 1.15,
              }}
            >
              Sélectionnez un service
            </h1>
            <div className="text-[15px] text-[#475569]">
              Choisissez le module correspondant à votre activité pour accéder à
              ses fonctions.
            </div>
          </div>
          {derniere ? (
            <div className="text-[13px] text-[#64748b]">{derniere}</div>
          ) : null}
        </div>

        {accessiblePortails.length === 0 ? (
          <div className="rounded-lg border border-[#e2e8f0] bg-white px-6 py-8 text-center text-sm text-[#64748b]">
            Aucun portail n&apos;est accessible avec votre compte. Contactez un
            administrateur.
          </div>
        ) : (
          <div
            className="grid gap-5"
            style={{
              gridTemplateColumns:
                "repeat(auto-fit, minmax(min(100%, 250px), 1fr))",
            }}
          >
            {accessiblePortails.map((portail, index) => (
              <PortailCard
                key={portail.id}
                portail={portail}
                index={index}
                onSelect={() => navigate(portail.path)}
              />
            ))}
          </div>
        )}
      </main>

      <footer className="flex flex-wrap justify-between gap-2 border-t border-[#e2e8f0] bg-white px-5 py-[18px] text-xs text-[#64748b] sm:px-8">
        <span>DGCPT · Direction des Opérations Monétaires et Financières</span>
        <span>GESPOF v1.0.0</span>
      </footer>
    </div>
  );
};

export default PortailSelection;

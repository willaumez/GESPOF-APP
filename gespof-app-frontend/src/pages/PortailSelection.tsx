import { useNavigate, Navigate } from "react-router-dom";
import { useAuth } from "@/shared/hooks/use-auth";
import { AccountMenu } from "@/shared/components/layout/AccountMenu";
import { getAccessiblePortails } from "@/shared/config/menu";
import type { MenuPortal } from "@/shared/types/menu.interface";

const LOGO_GESPOF = "/GESPOF-logo-tr.png";

function PortailCard({
  portail,
  index,
  onSelect,
}: {
  portail: MenuPortal;
  index: number;
  onSelect: () => void;
}) {
  const Icon = portail.icon;
  const accent = portail.theme.topColor;

  return (
    <button
      type="button"
      onClick={onSelect}
      aria-label={`${portail.ctaLabel} — ${portail.subtitle}`}
      className="group relative flex min-h-[14rem] flex-col overflow-hidden rounded-xl bg-white text-left outline-none transition-[transform,box-shadow,border-color] duration-200 ease-out hover:-translate-y-0.5 focus-visible:ring-2 focus-visible:ring-offset-2 motion-reduce:transition-none motion-reduce:hover:translate-y-0 motion-reduce:animate-none"
      style={{
        border: "1px solid #e2e8f0",
        boxShadow: "0 1px 2px rgba(15,23,42,0.04)",
        animation: `popIn 0.45s ease ${0.12 + index * 0.07}s both`,
        ["--tw-ring-color" as string]: accent,
        ...(portail.id === "sr"
          ? { fontFamily: "'Inter', Arial, sans-serif" }
          : {}),
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = `${accent}55`;
        e.currentTarget.style.boxShadow = `0 12px 28px -8px ${accent}28, 0 4px 12px rgba(15,23,42,0.06)`;
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = "#e2e8f0";
        e.currentTarget.style.boxShadow = "0 1px 2px rgba(15,23,42,0.04)";
      }}
    >
      {/* Rail d'accent — même langage que les layouts de portail */}
      <span
        aria-hidden
        className="absolute inset-y-0 left-0 w-[3px] transition-[width] duration-200 group-hover:w-1"
        style={{ background: accent }}
      />

      {portail.badge && (
        <span
          className="absolute right-4 top-4 rounded-md px-2 py-1 text-[10px] font-semibold tracking-wide"
          style={{
            background: `${accent}14`,
            color: accent,
          }}
        >
          {portail.badge}
        </span>
      )}

      <div className="flex flex-1 flex-col px-7 py-7 pl-8">
        {portail.logo ? (
          <img
            src={portail.logo}
            alt={`${portail.title} — ${portail.subtitle}`}
            className="mb-5 h-[5.25rem] w-full object-contain object-left transition-transform duration-300 group-hover:scale-[1.02] motion-reduce:group-hover:scale-100"
          />
        ) : (
          <>
            <div
              className="mb-5 flex size-14 items-center justify-center rounded-lg transition-transform duration-300 group-hover:scale-105 motion-reduce:group-hover:scale-100"
              style={{ background: portail.theme.iconBg }}
            >
              <Icon
                size={26}
                color={portail.theme.iconColor}
                strokeWidth={1.8}
              />
            </div>
            <h2 className="mb-1 text-[1.375rem] font-bold leading-tight text-[#0f172a]">
              {portail.title}
            </h2>
            <p
              className="mb-2.5 text-[14px] font-semibold"
              style={{ color: accent }}
            >
              {portail.subtitle}
            </p>
          </>
        )}

        <p className="mb-6 flex-1 text-[14px] leading-relaxed text-[#64748b]">
          {portail.description}
        </p>

        <span
          className="mt-auto inline-flex items-center gap-2 text-[14px] font-bold"
          style={{ color: accent }}
        >
          {portail.ctaLabel}
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
            className="transition-transform duration-200 group-hover:translate-x-1 motion-reduce:group-hover:translate-x-0"
          >
            <path d="M5 12h14M12 5l7 7-7 7" />
          </svg>
        </span>
      </div>
    </button>
  );
}

const PortailSelection = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const accessiblePortails = getAccessiblePortails(user?.roles ?? []);

  if (accessiblePortails.length === 1) {
    return <Navigate to={accessiblePortails[0].path} replace />;
  }

  const nomComplet = user
    ? `${user.nom ?? ""} ${user.prenom ?? ""}`.trim()
    : "";

  const gridClass =
    accessiblePortails.length === 2
      ? "grid w-full max-w-4xl gap-6 sm:grid-cols-2"
      : "grid w-full max-w-7xl gap-6 sm:grid-cols-2 lg:grid-cols-4";

  return (
    <div
      className="relative min-h-screen overflow-x-hidden"
      style={{
        background:
          "radial-gradient(ellipse 90% 60% at 8% -10%, rgba(42,127,98,0.09) 0%, transparent 55%), radial-gradient(ellipse 70% 50% at 92% 0%, rgba(7,96,168,0.08) 0%, transparent 50%), radial-gradient(ellipse 50% 40% at 70% 100%, rgba(201,150,10,0.06) 0%, transparent 45%), #f8fafc",
      }}
    >
      {/* Motif discret type « papier institutionnel » */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.35]"
        style={{
          backgroundImage:
            "radial-gradient(circle at 1px 1px, rgba(15,23,42,0.06) 1px, transparent 0)",
          backgroundSize: "22px 22px",
          maskImage:
            "linear-gradient(to bottom, black 0%, black 40%, transparent 85%)",
        }}
      />

      <nav
        className="relative z-10 flex items-center justify-between bg-white/85 px-5 py-3 backdrop-blur-md sm:px-8"
        style={{
          borderBottom: "1px solid #e2e8f0",
          animation: "fadeUp 0.4s ease both",
        }}
      >
        <div className="flex items-center gap-3">
          <img
            src={LOGO_GESPOF}
            alt="Logo GESPOF"
            className="h-10 w-10 flex-shrink-0 object-contain"
          />
          <div>
            <p className="text-[15px] font-bold leading-none tracking-wide text-[#0f172a]">
              GESPOF
            </p>
            <p className="mt-1 text-[9px] font-semibold uppercase tracking-[0.18em] text-[#64748b]">
              Portail des Services
            </p>
          </div>
        </div>

        <div style={{ animation: "fadeIn 0.4s ease 0.12s both" }}>
          <AccountMenu />
        </div>
      </nav>

      {/* Barre tricolore institutionnelle (alignée Login) */}
      <div
        aria-hidden
        className="relative z-10 flex h-[3px] w-full"
        style={{ animation: "fadeIn 0.5s ease 0.08s both" }}
      >
        <span className="flex-1 bg-[#2a7f62]" />
        <span className="flex-1 bg-[#c9960a]" />
        <span className="flex-1 bg-[#0760A8]" />
      </div>

      <main className="relative z-10 flex flex-col items-center px-4 pb-16 pt-10 sm:px-6 sm:pt-14">
        <header
          className="mb-10 max-w-2xl text-center sm:mb-12"
          style={{ animation: "fadeUp 0.5s ease 0.1s both" }}
        >
          {nomComplet ? (
            <p className="mb-3 text-[13px] text-[#64748b]">
              Bienvenue,{" "}
              <span className="font-semibold text-[#0f172a]">{nomComplet}</span>
            </p>
          ) : null}

          <h1 className="mb-3 text-[1.875rem] font-bold leading-tight tracking-tight text-[#0f172a] sm:text-[2.25rem]">
            Sélectionnez un service
          </h1>

          <p className="mx-auto max-w-md text-[14px] leading-relaxed text-[#64748b]">
            Choisissez le module correspondant à votre activité pour accéder à
            ses fonctions.
          </p>
        </header>

        {accessiblePortails.length === 0 ? (
          <div
            className="w-full max-w-md rounded-xl border border-[#e2e8f0] bg-white px-6 py-8 text-center"
            style={{ animation: "fadeUp 0.45s ease 0.15s both" }}
          >
            <p className="text-[14px] leading-relaxed text-[#64748b]">
              Aucun portail n&apos;est accessible avec votre compte. Contactez
              un administrateur.
            </p>
          </div>
        ) : (
          <div className={gridClass}>
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
    </div>
  );
};

export default PortailSelection;

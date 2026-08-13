import { useNavigate, Navigate } from "react-router-dom";
import logo from "@/assets/SIGOF-logo-tr.png";
import { useAuth } from "../hooks/use-auth";
import { AccountMenu } from "@/components/AccountMenu";
import { getAccessiblePortails } from "@/config/menu";
import { resolveIcon } from "@/lib/icons";

const PortailSelection = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const accessiblePortails = getAccessiblePortails(user?.roles ?? []);

  if (accessiblePortails.length === 1) {
    return <Navigate to={accessiblePortails[0].path} replace />;
  }

  const gridClass =
    accessiblePortails.length === 2
      ? "grid w-full max-w-3xl gap-6 sm:grid-cols-2"
      : "grid w-full max-w-7xl gap-6 sm:grid-cols-2 lg:grid-cols-4";

  return (
    <div className="min-h-screen" style={{ background: "#f8fafc" }}>
      {}
      <nav
        className="flex items-center justify-between bg-white px-5 py-3 sm:px-8"
        style={{
          borderBottom: "1px solid #e2e8f0",
          boxShadow: "0 1px 6px rgba(0,0,0,0.05)",
          animation: "fadeUp 0.4s ease both",
        }}
      >
        {}
        <div className="flex items-center gap-3">
          <img
            src={logo}
            alt="Logo Trésor Public"
            className="h-10 w-10 flex-shrink-0 object-contain"
          />
          <div>
            <p
              className="text-[15px] font-bold leading-none text-[#0f172a]"
              style={{ fontFamily: "'Geist Variable', sans-serif" }}
            >
              SIGOF
            </p>
            <p className="mt-[3px] text-[9px] font-semibold uppercase tracking-[0.18em] text-[#64748b]">
              Portail des Services
            </p>
          </div>
        </div>

        {}
        <div
          className="flex items-center"
          style={{ animation: "fadeIn 0.4s ease 0.15s both" }}
        >
          <AccountMenu />
        </div>
      </nav>

      {}
      <main className="flex flex-col items-center px-4 py-12 sm:py-16">
        {}
        <div
          className="mb-12 text-center"
          style={{ animation: "fadeUp 0.5s ease 0.1s both" }}
        >
          <div
            className="mb-5 inline-flex items-center rounded-full px-4 py-[6px] text-[11px] font-semibold uppercase tracking-[0.13em]"
            style={{
              background: "rgba(217,119,6,0.08)",
              border: "1px solid rgba(217,119,6,0.32)",
              color: "#d97706",
            }}
          >
            Bienvenue,{" "}
            {user ? `${user.nom ?? ""} ${user.prenom ?? ""}`.trim() : "—"}
          </div>
          <h1
            className="mb-3 text-[34px] font-bold leading-tight text-[#0f172a] sm:text-[40px]"
            style={{ fontFamily: "'Geist Variable', sans-serif" }}
          >
            Sélectionnez un service
          </h1>
          <p className="max-w-[440px] text-[14px] leading-[1.7] text-[#64748b]">
            Choisissez le module correspondant à votre activité pour accéder à
            ses fonctions.
          </p>
        </div>

        {}
        {accessiblePortails.length === 0 ? (
          <p className="text-[14px] text-[#64748b]">
            Aucun portail n'est accessible avec votre compte. Contactez un administrateur.
          </p>
        ) : (
        <div className={gridClass}>
          {accessiblePortails.map((portail, index) => {
            const Icon = resolveIcon(portail.icon);
            return (
              <button
                key={portail.id}
                onClick={() => navigate(portail.path)}
                className="group relative flex flex-col rounded-2xl bg-white text-left transition-all duration-300 hover:-translate-y-1"
                style={{
                  border: `1px solid #e2e8f0`,
                  borderTop: `4px solid ${portail.theme.topColor}`,
                  boxShadow:
                    "0 1px 4px rgba(0,0,0,0.05), 0 4px 16px rgba(0,0,0,0.04)",
                  animation: `popIn 0.5s ease ${0.05 + index * 0.1}s both`,
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.boxShadow =
                    "0 8px 28px rgba(0,0,0,0.09), 0 2px 8px rgba(0,0,0,0.05)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.boxShadow =
                    "0 1px 4px rgba(0,0,0,0.05), 0 4px 16px rgba(0,0,0,0.04)";
                }}
              >
                {}
                {portail.badge && (
                  <span
                    className="absolute right-4 top-4 rounded-full px-2.5 py-[5px] text-[10px] font-bold uppercase tracking-wider"
                    style={{
                      background: "rgba(217,119,6,0.11)",
                      color: "#d97706",
                    }}
                  >
                    {portail.badge}
                  </span>
                )}

                <div className="flex flex-col p-7">
                  {}
                  <div
                    className="mb-5 flex h-14 w-14 items-center justify-center rounded-xl transition-transform duration-300 group-hover:scale-105"
                    style={{ background: portail.theme.iconBg }}
                  >
                    <Icon
                      size={24}
                      color={portail.theme.iconColor}
                      strokeWidth={1.8}
                    />
                  </div>

                  {}
                  <h2
                    className="mb-1 text-[22px] font-bold leading-tight text-[#0f172a]"
                    style={{ fontFamily: "'Geist Variable', sans-serif" }}
                  >
                    {portail.title}
                  </h2>
                  <p
                    className="mb-3 text-[13px] font-semibold"
                    style={{ color: portail.theme.ctaColor }}
                  >
                    {portail.subtitle}
                  </p>
                  <p className="mb-6 text-[13px] leading-[1.65] text-[#64748b]">
                    {portail.description}
                  </p>

                  {}
                  <div
                    className="mt-auto flex items-center gap-2 text-[13px] font-bold"
                    style={{ color: portail.theme.ctaColor }}
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
                      className="transition-transform duration-300 group-hover:translate-x-1"
                    >
                      <path d="M5 12h14M12 5l7 7-7 7" />
                    </svg>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
        )}
      </main>
    </div>
  );
};

export default PortailSelection;

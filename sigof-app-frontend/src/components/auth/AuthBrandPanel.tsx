import logo from "@/assets/SIGOF-logo-tr.png";
import { useAuthEntranceAnimee } from "./AuthEntranceContext";

export function AuthBrandPanel() {
  const animer = useAuthEntranceAnimee();

  return (
    <div className="flex flex-col items-center justify-center text-center lg:pr-10">
      <div
        className={`mb-5 flex size-[9.5rem] items-center justify-center overflow-hidden ${animer ? "[animation:popIn_.5s_ease_.1s_both]" : ""}`}
      >
        <img
          src={logo}
          alt="Logo SIGOF"
          className="h-full w-full object-contain"
        />
      </div>
      <h2
        className={`mb-1 text-lg font-bold tracking-[.05em] text-[#0f172a] ${animer ? "[animation:fadeUp_.5s_ease_.16s_both]" : ""}`}
        style={{ fontFamily: "'Geist Variable', sans-serif" }}
      >
        SIGOF
      </h2>
      <p
        className={`mb-4 text-[0.625rem] font-semibold uppercase tracking-[.24em] text-[#64748b] ${animer ? "[animation:fadeUp_.5s_ease_.2s_both]" : ""}`}
      >
        Système Intégré de Gestion des Opérations Financières
      </p>

      <div className={`mb-4 flex items-center gap-1.5 ${animer ? "[animation:fadeIn_.5s_ease_.22s_both]" : ""}`}>
        <div className="h-[0.1875rem] w-9 rounded-full bg-[#2a7f62]" />
        <div className="h-[0.1875rem] w-9 rounded-full bg-[#c9960a]" />
        <div className="h-[0.1875rem] w-9 rounded-full bg-[#1e4d8c]" />
      </div>

      <p
        className={`max-w-[17.5rem] text-[0.78125rem] leading-[1.6] text-[#64748b] ${animer ? "[animation:fadeUp_.5s_ease_.32s_both]" : ""}`}
      >
        Direction des Opérations Monétaires et Financières — pilotez vos
        opérations depuis un portail unique et sécurisé.
      </p>
    </div>
  );
}
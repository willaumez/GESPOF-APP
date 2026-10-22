import { useAuthEntranceAnimee } from "./AuthEntranceContext";

const LOGO_GESPOF = "/GESPOF-logo-tr.png";

/**
 * Marque GESPOF à gauche (desktop) / en haut (mobile).
 * Sur petit écran : version compacte pour laisser la place au formulaire.
 */
export function AuthBrandPanel() {
  const animer = useAuthEntranceAnimee();

  return (
    <div className="flex w-full flex-col items-center justify-center text-center lg:pr-10">
      <div
        className={`mb-2.5 flex size-[4.75rem] items-center justify-center overflow-hidden sm:mb-4 sm:size-[7rem] lg:mb-5 lg:size-[9.5rem] ${animer ? "[animation:popIn_.5s_ease_.1s_both]" : ""}`}
      >
        <img
          src={LOGO_GESPOF}
          alt="Logo GESPOF"
          className="h-full w-full object-contain"
        />
      </div>

      <h2
        className={`mb-0.5 text-base font-bold tracking-[.05em] text-[#0f172a] sm:mb-1 sm:text-lg ${animer ? "[animation:fadeUp_.5s_ease_.16s_both]" : ""}`}
      >
        GESPOF
      </h2>

      <p
        className={`mb-2.5 max-w-[16rem] text-[0.5625rem] font-semibold uppercase leading-relaxed tracking-[.14em] text-[#64748b] sm:mb-4 sm:max-w-[20rem] sm:text-[0.625rem] sm:tracking-[.2em] lg:tracking-[.24em] ${animer ? "[animation:fadeUp_.5s_ease_.2s_both]" : ""}`}
      >
        Gestion des Prévisions et des Opérations Financières
      </p>

      <div
        className={`mb-2.5 flex items-center gap-1.5 sm:mb-4 ${animer ? "[animation:fadeIn_.5s_ease_.22s_both]" : ""}`}
      >
        <div className="h-[0.1875rem] w-7 rounded-full bg-[#2a7f62] sm:w-9" />
        <div className="h-[0.1875rem] w-7 rounded-full bg-[#c9960a] sm:w-9" />
        <div className="h-[0.1875rem] w-7 rounded-full bg-[#1e4d8c] sm:w-9" />
      </div>

      <p
        className={`hidden max-w-[17.5rem] text-[0.78125rem] leading-[1.6] text-[#64748b] sm:block ${animer ? "[animation:fadeUp_.5s_ease_.32s_both]" : ""}`}
      >
        Direction des Opérations Monétaires et Financières — pilotez vos
        opérations depuis un portail unique et sécurisé.
      </p>
    </div>
  );
}

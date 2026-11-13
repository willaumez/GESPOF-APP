import { useAuthEntranceAnimee } from "./AuthEntranceContext";

const LOGO_GESPOF = "/GESPOF-logo.png";

/** Panneau marque — valeurs exactes maquette Prototype v2. */
export function AuthBrandPanel() {
  const animer = useAuthEntranceAnimee();

  return (
    <div
      className={`am-brand ${animer ? "[animation:popIn_.5s_ease_.1s_both]" : ""}`}
    >
      <img
        src={LOGO_GESPOF}
        alt="Logo GESPOF"
        style={{
          width: 152,
          height: 152,
          objectFit: "contain",
          marginBottom: 20,
        }}
      />

      <h2 className="am-title-brand">GESPOF</h2>
      <p className="am-tagline">
        Gestion des Prévisions et des Opérations Financières
      </p>

      <div
        style={{
          display: "flex",
          gap: 6,
          marginBottom: 16,
        }}
      >
        <span
          style={{
            width: 36,
            height: 3,
            borderRadius: 2,
            background: "#2a7f62",
          }}
        />
        <span
          style={{
            width: 36,
            height: 3,
            borderRadius: 2,
            background: "#c9960a",
          }}
        />
        <span
          style={{
            width: 36,
            height: 3,
            borderRadius: 2,
            background: "#1e4d8c",
          }}
        />
      </div>

      <p className="am-desc">
        Direction des Opérations Monétaires et Financières — pilotez vos
        opérations depuis un portail unique et sécurisé.
      </p>
    </div>
  );
}

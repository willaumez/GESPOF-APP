import { createContext, useContext, useState } from "react";

let dejaJouee = false;

export function useEstPremierChargementAuth(): boolean {
  const [estPremier] = useState(() => {
    const premier = !dejaJouee;
    dejaJouee = true;
    return premier;
  });
  return estPremier;
}

export const AuthEntranceContext = createContext(false);

export const useAuthEntranceAnimee = () => useContext(AuthEntranceContext);

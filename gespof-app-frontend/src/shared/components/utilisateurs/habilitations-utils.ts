import { infoMetier } from "@/shared/lib/metiers";
import { LIBELLE_ACCES, type Acces } from "@/shared/lib/acces";
import type { RoleUtilisateur } from "@/shared/hooks/auth-context";

/** Ajoute ou retire `code` de la liste des accès autorisés (toggle immuable). */
export function basculerAcces(acces: Acces[], code: Acces): Acces[] {
  return acces.includes(code) ? acces.filter((c) => c !== code) : [...acces, code];
}

/** Accès accordés par défaut par un métier — valeur initiale de la liste d'accès. */
export function accesParDefaut(metier: RoleUtilisateur | ""): Acces[] {
  return metier ? infoMetier(metier)?.accesParDefaut ?? [] : [];
}

/** Un métier a-t-il des habilitations individuelles configurables (catalogue non vide) ? */
export function metierAHabilitations(metier: RoleUtilisateur | ""): boolean {
  return accesParDefaut(metier).length > 0;
}

/** Catalogue des habilitations d'un métier, filtré par un terme de recherche (sur le libellé). */
export function filtrerCatalogue(metier: RoleUtilisateur | "", recherche = ""): Acces[] {
  const catalogue = accesParDefaut(metier);
  const terme = recherche.trim().toLowerCase();
  if (!terme) return catalogue;
  return catalogue.filter((code) => LIBELLE_ACCES[code].toLowerCase().includes(terme));
}

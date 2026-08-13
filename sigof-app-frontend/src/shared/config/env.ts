/**
 * Point d'accès unique à `import.meta.env`. Aucun autre fichier du projet ne
 * doit lire `import.meta.env` directement : il passe par cet objet.
 */
export const ENV = {
  MODE: import.meta.env.MODE || "development",
  DEV: import.meta.env.DEV || false,
  VITE_API_BASE_URL: import.meta.env.VITE_API_BASE_URL || "",
} as const;

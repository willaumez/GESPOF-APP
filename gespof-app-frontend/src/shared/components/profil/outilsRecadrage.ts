/** Limite alignée sur PhotosDeProfil::TAILLE_MAX (5 Mo). */
export const TAILLE_MAX_PHOTO = 5 * 1024 * 1024;

export const MESSAGE_TAILLE_PHOTO =
  "Choisissez une photo JPEG ou PNG de 5 Mo au plus.";

/** Vue carrée pour l’avatar circulaire. */
export const FORMAT_AVATAR = {
  vueLargeur: 320,
  vueHauteur: 320,
  sortieLargeur: 512,
  sortieHauteur: 512,
} as const;

/** Vue paysage pour le bandeau cover (~ratio 3,1:1). */
export const FORMAT_BANDEAU = {
  vueLargeur: 480,
  vueHauteur: 154,
  sortieLargeur: 1200,
  sortieHauteur: 385,
} as const;

export type ModeRecadrage = "avatar" | "bandeau";

export type FormatRecadrage = {
  vueLargeur: number;
  vueHauteur: number;
  sortieLargeur: number;
  sortieHauteur: number;
};

export function formatDuMode(mode: ModeRecadrage): FormatRecadrage {
  return mode === "bandeau" ? FORMAT_BANDEAU : FORMAT_AVATAR;
}

export type DecalagePhoto = { x: number; y: number };

/** Scale de base pour que l’image couvre toute la vue au zoom 1. */
export function echelleDeBase(
  largeur: number,
  hauteur: number,
  vueLargeur = FORMAT_AVATAR.vueLargeur,
  vueHauteur = FORMAT_AVATAR.vueHauteur,
): number {
  return Math.max(vueLargeur / largeur, vueHauteur / hauteur);
}

/** Bornes du décalage pour que la vue reste entièrement remplie. */
export function bornerDecalage(
  largeur: number,
  hauteur: number,
  zoom: number,
  decalage: DecalagePhoto,
  vueLargeur = FORMAT_AVATAR.vueLargeur,
  vueHauteur = FORMAT_AVATAR.vueHauteur,
): DecalagePhoto {
  const echelle = echelleDeBase(largeur, hauteur, vueLargeur, vueHauteur) * zoom;
  const afficheeL = largeur * echelle;
  const afficheeH = hauteur * echelle;
  const maxX = Math.max(0, (afficheeL - vueLargeur) / 2);
  const maxY = Math.max(0, (afficheeH - vueHauteur) / 2);

  const x = Math.min(maxX, Math.max(-maxX, decalage.x));
  const y = Math.min(maxY, Math.max(-maxY, decalage.y));

  return { x: x === 0 ? 0 : x, y: y === 0 ? 0 : y };
}

/** Exporte le carré visible (JPEG). */
export function exporterCarre(
  image: HTMLImageElement,
  zoom: number,
  decalage: DecalagePhoto,
  vueLargeur = FORMAT_AVATAR.vueLargeur,
  vueHauteur = FORMAT_AVATAR.vueHauteur,
  sortieLargeur = FORMAT_AVATAR.sortieLargeur,
  sortieHauteur = FORMAT_AVATAR.sortieHauteur,
): Promise<File> {
  const echelle =
    echelleDeBase(image.naturalWidth, image.naturalHeight, vueLargeur, vueHauteur) *
    zoom;
  const afficheeL = image.naturalWidth * echelle;
  const afficheeH = image.naturalHeight * echelle;
  const gauche = vueLargeur / 2 - afficheeL / 2 + decalage.x;
  const haut = vueHauteur / 2 - afficheeH / 2 + decalage.y;
  const sx = (0 - gauche) / echelle;
  const sy = (0 - haut) / echelle;
  const sw = vueLargeur / echelle;
  const sh = vueHauteur / echelle;

  const toile = document.createElement("canvas");
  toile.width = sortieLargeur;
  toile.height = sortieHauteur;
  const contexte = toile.getContext("2d");
  if (!contexte) {
    return Promise.reject(new Error("Recadrage impossible sur ce navigateur."));
  }
  contexte.imageSmoothingEnabled = true;
  contexte.imageSmoothingQuality = "high";
  contexte.drawImage(image, sx, sy, sw, sh, 0, 0, sortieLargeur, sortieHauteur);

  return new Promise((resoudre, rejeter) => {
    toile.toBlob(
      (blob) => {
        if (!blob) {
          rejeter(new Error("Recadrage impossible sur ce navigateur."));
          return;
        }
        resoudre(new File([blob], "photo-profil.jpg", { type: "image/jpeg" }));
      },
      "image/jpeg",
      0.92,
    );
  });
}

/** Charge l'image ; l'appelant doit révoquer `url` au démontage. */
export function lireImage(
  fichier: File,
): Promise<{ image: HTMLImageElement; url: string }> {
  return new Promise((resoudre, rejeter) => {
    const url = URL.createObjectURL(fichier);
    const image = new Image();
    image.onload = () => resoudre({ image, url });
    image.onerror = () => {
      URL.revokeObjectURL(url);
      rejeter(new Error("Impossible de lire cette image."));
    };
    image.src = url;
  });
}

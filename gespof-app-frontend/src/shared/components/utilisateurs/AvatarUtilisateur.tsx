import { useEffect, useState } from "react";
import { UTILISATEURS_ENDPOINT } from "@/shared/api/utilisateurs";
import { requeteApiBlob } from "@/shared/lib/api";
import { cn } from "@/shared/lib/utils";

type Props = {
  id: number | null | undefined;
  nom: string;
  prenom: string;
  aPhoto?: boolean;
  /** Taille CSS (ex. 32 → size-8). */
  taille?: number;
  className?: string;
  /** Fond / texte des initiales (thème portail). */
  fondInitiales?: string;
  couleurInitiales?: string;
};

function initiales(nom: string, prenom: string): string {
  const a = (prenom?.[0] ?? "").toUpperCase();
  const b = (nom?.[0] ?? "").toUpperCase();
  return `${a}${b}` || "?";
}

/**
 * Avatar liste / fiche utilisateur : photo si `a_photo`, sinon initiales.
 */
export function AvatarUtilisateur({
  id,
  nom,
  prenom,
  aPhoto,
  taille = 32,
  className,
  fondInitiales = "#e2e8f0",
  couleurInitiales = "#0f172a",
}: Props) {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!aPhoto || id == null) {
      setUrl(null);
      return;
    }
    let annule = false;
    let objet: string | null = null;
    void requeteApiBlob(`${UTILISATEURS_ENDPOINT}/${id}/photo`)
      .then((blob) => {
        if (annule) return;
        objet = URL.createObjectURL(blob);
        setUrl(objet);
      })
      .catch(() => {
        if (!annule) setUrl(null);
      });
    return () => {
      annule = true;
      if (objet) URL.revokeObjectURL(objet);
    };
  }, [aPhoto, id]);

  const styleTaille = {
    width: taille,
    height: taille,
    fontSize: Math.max(10, Math.round(taille * 0.34)),
  };

  if (url) {
    return (
      <span
        className={cn(
          "inline-flex shrink-0 overflow-hidden rounded-full bg-[#e2e8f0]",
          className,
        )}
        style={styleTaille}
        aria-hidden
      >
        <img
          src={url}
          alt=""
          className="size-full object-cover"
          width={taille}
          height={taille}
        />
      </span>
    );
  }

  return (
    <span
      className={cn(
        "grid shrink-0 place-items-center rounded-full font-semibold",
        className,
      )}
      style={{
        ...styleTaille,
        background: fondInitiales,
        color: couleurInitiales,
      }}
      aria-hidden
    >
      {initiales(nom, prenom)}
    </span>
  );
}

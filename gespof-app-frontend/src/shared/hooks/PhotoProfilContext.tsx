import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { API_ENDPOINTS } from "@/shared/config/app";
import { requeteApi, requeteApiBlob } from "@/shared/lib/api";
import { useAuth } from "@/shared/hooks/use-auth";

type PhotoProfilContextValue = {
  photoUrl: string | null;
  /** Cover profil (recadrage bandeau) ; repli sur `photoUrl` si absent. */
  bandeauUrl: string | null;
  aPhoto: boolean;
  version: number;
  /** Recharge /me + blobs (après dépôt / retrait). */
  rafraichirPhoto: () => void;
};

const PhotoProfilContext = createContext<PhotoProfilContextValue | null>(null);

/**
 * Photo de profil session : blob URL partagée (Profil + AccountMenu topbar).
 */
export function PhotoProfilProvider({ children }: { children: ReactNode }) {
  const { token, isAuthenticated } = useAuth();
  const [aPhoto, setAPhoto] = useState(false);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [bandeauUrl, setBandeauUrl] = useState<string | null>(null);
  const [version, setVersion] = useState(0);

  const rafraichirPhoto = useCallback(() => {
    setVersion((v) => v + 1);
  }, []);

  useEffect(() => {
    if (!isAuthenticated || !token) {
      setAPhoto(false);
      setPhotoUrl(null);
      setBandeauUrl(null);
      return;
    }

    let annule = false;
    let urlAvatar: string | null = null;
    let urlBandeau: string | null = null;

    void (async () => {
      try {
        const me = await requeteApi<{ a_photo?: boolean }>(API_ENDPOINTS.AUTH.ME, {
          jeton: token,
        });
        if (annule) return;
        const has = !!me.a_photo;
        setAPhoto(has);
        if (!has) {
          setPhotoUrl(null);
          setBandeauUrl(null);
          return;
        }
        const blobAvatar = await requeteApiBlob(
          `${API_ENDPOINTS.AUTH.ME_PHOTO}?t=${version}`,
        );
        if (annule) return;
        urlAvatar = URL.createObjectURL(blobAvatar);
        setPhotoUrl(urlAvatar);

        try {
          const blobBandeau = await requeteApiBlob(
            `${API_ENDPOINTS.AUTH.ME_PHOTO_BANDEAU}?t=${version}`,
          );
          if (annule) return;
          urlBandeau = URL.createObjectURL(blobBandeau);
          setBandeauUrl(urlBandeau);
        } catch {
          if (!annule) setBandeauUrl(urlAvatar);
        }
      } catch {
        if (!annule) {
          setAPhoto(false);
          setPhotoUrl(null);
          setBandeauUrl(null);
        }
      }
    })();

    return () => {
      annule = true;
      if (urlAvatar) URL.revokeObjectURL(urlAvatar);
      if (urlBandeau && urlBandeau !== urlAvatar) URL.revokeObjectURL(urlBandeau);
    };
  }, [isAuthenticated, token, version]);

  const value = useMemo(
    () => ({
      photoUrl,
      bandeauUrl: bandeauUrl ?? photoUrl,
      aPhoto,
      version,
      rafraichirPhoto,
    }),
    [photoUrl, bandeauUrl, aPhoto, version, rafraichirPhoto],
  );

  return (
    <PhotoProfilContext.Provider value={value}>
      {children}
    </PhotoProfilContext.Provider>
  );
}

export function usePhotoProfil(): PhotoProfilContextValue {
  const ctx = useContext(PhotoProfilContext);
  if (!ctx) {
    throw new Error("usePhotoProfil must be used within PhotoProfilProvider");
  }
  return ctx;
}

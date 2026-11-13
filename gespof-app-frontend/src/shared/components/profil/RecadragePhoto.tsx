import {
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/shared/components/ui/dialog";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/shared/components/ui/tabs";
import {
  bornerDecalage,
  echelleDeBase,
  exporterCarre,
  formatDuMode,
  lireImage,
  type DecalagePhoto,
  type ModeRecadrage,
} from "./outilsRecadrage";

export type RecadragesPhoto = {
  avatar: File;
  bandeau: File;
};

type EtatCadrage = {
  zoom: number;
  decalage: DecalagePhoto;
};

const CADRAGE_INITIAL: EtatCadrage = { zoom: 1, decalage: { x: 0, y: 0 } };

type Props = {
  fichier: File;
  envoiEnCours: boolean;
  onAnnuler: () => void;
  onConfirmer: (recadrages: RecadragesPhoto) => void;
};

/**
 * Dialog de recadrage : onglets Avatar et Bandeau — les deux cadrages sont
 * conservés puis exportés ensemble à l’enregistrement.
 */
export function RecadragePhoto({
  fichier,
  envoiEnCours,
  onAnnuler,
  onConfirmer,
}: Props) {
  const [mode, setMode] = useState<ModeRecadrage>("avatar");
  const [cadrages, setCadrages] = useState<Record<ModeRecadrage, EtatCadrage>>({
    avatar: { ...CADRAGE_INITIAL },
    bandeau: { ...CADRAGE_INITIAL },
  });
  const format = formatDuMode(mode);
  const { vueLargeur, vueHauteur } = format;
  const { zoom, decalage } = cadrages[mode];

  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [urlImage, setUrlImage] = useState<string | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [exportEnCours, setExportEnCours] = useState(false);
  const glisser = useRef<{ x: number; y: number; origine: DecalagePhoto } | null>(
    null,
  );

  useEffect(() => {
    let annule = false;
    let urlCourante: string | null = null;
    setImage(null);
    setUrlImage(null);
    setErreur(null);
    setMode("avatar");
    setCadrages({
      avatar: { ...CADRAGE_INITIAL },
      bandeau: { ...CADRAGE_INITIAL },
    });
    void lireImage(fichier)
      .then(({ image: chargee, url }) => {
        if (annule) {
          URL.revokeObjectURL(url);
          return;
        }
        urlCourante = url;
        setImage(chargee);
        setUrlImage(url);
      })
      .catch(() => {
        if (!annule) setErreur("Impossible de lire cette image.");
      });

    return () => {
      annule = true;
      if (urlCourante) URL.revokeObjectURL(urlCourante);
    };
  }, [fichier]);

  const changerMode = (valeur: string) => {
    setMode(valeur === "bandeau" ? "bandeau" : "avatar");
  };

  const majCadrage = (partiel: Partial<EtatCadrage>) => {
    setCadrages((prev) => ({
      ...prev,
      [mode]: { ...prev[mode], ...partiel },
    }));
  };

  const decalageBorne = useMemo(() => {
    if (!image) return decalage;
    return bornerDecalage(
      image.naturalWidth,
      image.naturalHeight,
      zoom,
      decalage,
      vueLargeur,
      vueHauteur,
    );
  }, [image, zoom, decalage, vueLargeur, vueHauteur]);

  const styleImage = useMemo((): CSSProperties | undefined => {
    if (!image) return undefined;
    const echelle =
      echelleDeBase(
        image.naturalWidth,
        image.naturalHeight,
        vueLargeur,
        vueHauteur,
      ) * zoom;
    const largeur = image.naturalWidth * echelle;
    const hauteur = image.naturalHeight * echelle;
    return {
      width: largeur,
      height: hauteur,
      transform: `translate(${vueLargeur / 2 - largeur / 2 + decalageBorne.x}px, ${vueHauteur / 2 - hauteur / 2 + decalageBorne.y}px)`,
      maxWidth: "none",
    };
  }, [image, zoom, decalageBorne, vueLargeur, vueHauteur]);

  const commencer = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!image || envoiEnCours || exportEnCours) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    glisser.current = {
      x: event.clientX,
      y: event.clientY,
      origine: decalageBorne,
    };
  };

  const bouger = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!glisser.current || !image) return;
    const suivant = {
      x: glisser.current.origine.x + (event.clientX - glisser.current.x),
      y: glisser.current.origine.y + (event.clientY - glisser.current.y),
    };
    majCadrage({
      decalage: bornerDecalage(
        image.naturalWidth,
        image.naturalHeight,
        zoom,
        suivant,
        vueLargeur,
        vueHauteur,
      ),
    });
  };

  const finir = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (glisser.current) {
      event.currentTarget.releasePointerCapture(event.pointerId);
      glisser.current = null;
    }
  };

  const changerZoom = (valeur: number) => {
    if (!image) return;
    majCadrage({
      zoom: valeur,
      decalage: bornerDecalage(
        image.naturalWidth,
        image.naturalHeight,
        valeur,
        decalage,
        vueLargeur,
        vueHauteur,
      ),
    });
  };

  const exporterMode = async (
    cible: ModeRecadrage,
    img: HTMLImageElement,
  ): Promise<File> => {
    const fmt = formatDuMode(cible);
    const etat = cadrages[cible];
    const dec = bornerDecalage(
      img.naturalWidth,
      img.naturalHeight,
      etat.zoom,
      etat.decalage,
      fmt.vueLargeur,
      fmt.vueHauteur,
    );
    const fichierRecadre = await exporterCarre(
      img,
      etat.zoom,
      dec,
      fmt.vueLargeur,
      fmt.vueHauteur,
      fmt.sortieLargeur,
      fmt.sortieHauteur,
    );
    const nom =
      cible === "bandeau" ? "photo-bandeau.jpg" : "photo-profil.jpg";
    return new File([fichierRecadre], nom, { type: "image/jpeg" });
  };

  const confirmer = async () => {
    if (!image) return;
    setExportEnCours(true);
    setErreur(null);
    try {
      const [avatar, bandeau] = await Promise.all([
        exporterMode("avatar", image),
        exporterMode("bandeau", image),
      ]);
      onConfirmer({ avatar, bandeau });
    } catch {
      setErreur("Recadrage impossible sur ce navigateur.");
    } finally {
      setExportEnCours(false);
    }
  };

  const occupe = envoiEnCours || exportEnCours;
  const estBandeau = mode === "bandeau";

  return (
    <Dialog
      open
      onOpenChange={(ouvert) => {
        if (!ouvert && !occupe) onAnnuler();
      }}
    >
      <DialogContent
        className={`gap-0 overflow-hidden p-0 ${estBandeau ? "sm:max-w-[560px]" : "sm:max-w-[440px]"}`}
      >
        <DialogHeader className="gap-1 border-b border-[#e2e8f0] px-6 py-5 text-left">
          <DialogTitle
            className="text-[19px] font-semibold leading-snug text-[#0f172a]"
            style={{ fontFamily: '"IBM Plex Serif", serif' }}
          >
            Recadrer la photo
          </DialogTitle>
          <DialogDescription className="text-[13.5px] leading-relaxed text-[#64748b]">
            {estBandeau
              ? "Glissez et zoomez pour cadrer le bandeau de couverture. Les deux cadrages seront enregistrés."
              : "Glissez et zoomez pour cadrer l’avatar circulaire. Les deux cadrages seront enregistrés."}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4 px-6 py-5">
          <Tabs value={mode} onValueChange={changerMode}>
            <TabsList variant="line" className="w-full justify-start">
              <TabsTrigger value="avatar" disabled={occupe}>
                Avatar
              </TabsTrigger>
              <TabsTrigger value="bandeau" disabled={occupe}>
                Bandeau
              </TabsTrigger>
            </TabsList>

            <TabsContent value="avatar" className="mt-4 outline-none">
              <ZoneRecadrage
                urlImage={urlImage}
                styleImage={styleImage}
                vueLargeur={vueLargeur}
                vueHauteur={vueHauteur}
                arrondi="full"
                commencer={commencer}
                bouger={bouger}
                finir={finir}
                label="Zone de recadrage avatar"
              />
            </TabsContent>

            <TabsContent value="bandeau" className="mt-4 outline-none">
              <ZoneRecadrage
                urlImage={urlImage}
                styleImage={styleImage}
                vueLargeur={vueLargeur}
                vueHauteur={vueHauteur}
                arrondi="lg"
                commencer={commencer}
                bouger={bouger}
                finir={finir}
                label="Zone de recadrage bandeau"
              />
            </TabsContent>
          </Tabs>

          <label className="flex flex-col gap-2 text-[13px] font-semibold text-[#334155]">
            Zoom
            <input
              type="range"
              min={1}
              max={3}
              step={0.05}
              value={zoom}
              disabled={!image || occupe}
              onChange={(e) => changerZoom(Number(e.target.value))}
              className="w-full accent-[#1e4d8c]"
            />
          </label>

          {erreur ? (
            <p className="text-[13px] text-[#b91c1c]" role="alert">
              {erreur}
            </p>
          ) : null}
        </div>

        <DialogFooter className="gap-2 border-t border-[#e2e8f0] bg-[#f8fafc] px-6 py-3.5 sm:justify-end">
          <button
            type="button"
            onClick={onAnnuler}
            disabled={occupe}
            className="inline-flex h-8 items-center rounded-md border border-[#cbd5e1] bg-white px-3 text-[13px] font-semibold text-[#0f172a] disabled:opacity-50"
          >
            Annuler
          </button>
          <button
            type="button"
            onClick={() => void confirmer()}
            disabled={!image || occupe}
            className="inline-flex h-8 items-center rounded-md border border-[#1e4d8c] bg-[#1e4d8c] px-3 text-[13px] font-semibold text-white disabled:opacity-50"
          >
            {occupe ? "Enregistrement…" : "Enregistrer les deux cadrages"}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ZoneRecadrage({
  urlImage,
  styleImage,
  vueLargeur,
  vueHauteur,
  arrondi,
  commencer,
  bouger,
  finir,
  label,
}: {
  urlImage: string | null;
  styleImage: CSSProperties | undefined;
  vueLargeur: number;
  vueHauteur: number;
  arrondi: "full" | "lg";
  commencer: (e: ReactPointerEvent<HTMLDivElement>) => void;
  bouger: (e: ReactPointerEvent<HTMLDivElement>) => void;
  finir: (e: ReactPointerEvent<HTMLDivElement>) => void;
  label: string;
}) {
  return (
    <div className="flex justify-center overflow-x-auto">
      <div
        className={`relative touch-none overflow-hidden border border-[#e2e8f0] bg-[#f8fafc] ${
          arrondi === "full" ? "rounded-full" : "rounded-lg"
        }`}
        style={{ width: vueLargeur, height: vueHauteur, cursor: "grab" }}
        onPointerDown={commencer}
        onPointerMove={bouger}
        onPointerUp={finir}
        onPointerCancel={finir}
        role="img"
        aria-label={label}
      >
        {urlImage ? (
          <img
            src={urlImage}
            alt=""
            draggable={false}
            className="absolute left-0 top-0 select-none"
            style={styleImage}
          />
        ) : null}
      </div>
    </div>
  );
}

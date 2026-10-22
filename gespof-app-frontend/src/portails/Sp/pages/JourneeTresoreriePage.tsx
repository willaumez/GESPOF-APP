import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Loader2, ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/shared/components/ui/button";
import {
  Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle,
} from "@/shared/components/ui/empty";
import { JourneeTresorerieVue } from "@/portails/Sp/components/fiche-matinale/JourneeTresorerieVue";
import { detailJourneeTresorerie } from "@/portails/Sp/api/journees-tresorerie";
import { useJourneeSelectionnee } from "@/portails/Sp/hooks/journee-selectionnee";
import type { JourneeTresorerie } from "@/portails/Sp/types/journee-tresorerie.interface";

const REF_JT = /^JT-\d{2}-\d{2}-\d{4}-\d{3}$/;

/**
 * Page `/sp/fiche-matinale/journee/:reference` — remplace complètement l'accueil
 * matinal, tout en restant sous l'entrée de menu « Fiche matinale ».
 */
export default function JourneeTresoreriePage() {
  const navigate = useNavigate();
  const { reference } = useParams<{ reference: string }>();
  const { appliquerJournee } = useJourneeSelectionnee();
  const [journee, setJournee] = useState<JourneeTresorerie | null>(null);
  const [loading, setLoading] = useState(true);
  const [erreur, setErreur] = useState(false);

  useEffect(() => {
    if (!reference || !REF_JT.test(reference)) {
      setErreur(true);
      setLoading(false);
      return;
    }

    setLoading(true);
    setErreur(false);
    detailJourneeTresorerie(reference)
      .then((data) => {
        setJournee(data.journee);
        // La TopBar reflète la journée ouverte depuis un lien ou la liste des archives.
        appliquerJournee(data.journee);
      })
      .catch((e) => {
        setErreur(true);
        toast.error(
          e instanceof Error ? e.message : "Impossible de charger la journée de trésorerie.",
        );
      })
      .finally(() => setLoading(false));
  }, [reference, appliquerJournee]);

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-muted-foreground">
        <Loader2 className="size-6 animate-spin" />
      </div>
    );
  }

  if (erreur || !journee) {
    return (
      <Empty>
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <ShieldAlert />
          </EmptyMedia>
          <EmptyTitle>Journée introuvable</EmptyTitle>
          <EmptyDescription>
            Cette journée de trésorerie n'a pas pu être chargée.
          </EmptyDescription>
        </EmptyHeader>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => void navigate("/sp/fiche-matinale")}
        >
          Retour à la fiche matinale
        </Button>
      </Empty>
    );
  }

  return (
    <JourneeTresorerieVue
      journee={journee}
      onJourneeChange={(maj) => {
        setJournee(maj);
        appliquerJournee(maj);
      }}
    />
  );
}

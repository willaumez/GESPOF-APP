import { useLayoutEffect, useRef, useState, type ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/shared/lib/utils";
import { Tabs, TabsList, TabsTrigger } from "@/shared/components/ui/tabs";

export interface OngletVueSp {
  value: string;
  label: string;
  icon: LucideIcon;
}

interface OngletsVueSpProps {
  valeur: string;
  onChange: (valeur: string) => void;
  onglets: OngletVueSp[];
  children: ReactNode;
}

const CLASSE_ONGLET =
  "relative z-10 h-7 flex-none bg-transparent px-2.5 shadow-none data-[state=inactive]:text-muted-foreground data-[state=active]:bg-transparent data-[state=active]:font-semibold data-[state=active]:text-[#a67a08] data-[state=active]:shadow-none data-[state=active]:[&_svg]:text-[#c9960a]";

export function OngletsVueSp({
  valeur,
  onChange,
  onglets,
  children,
}: OngletsVueSpProps) {
  const listeRef = useRef<HTMLDivElement>(null);
  const indexPrecedent = useRef(onglets.findIndex((o) => o.value === valeur));
  const [indicateur, setIndicateur] = useState({ left: 0, width: 0 });
  const [pret, setPret] = useState(false);

  const index = Math.max(
    0,
    onglets.findIndex((o) => o.value === valeur),
  );
  const versLaDroite = index >= indexPrecedent.current;
  indexPrecedent.current = index;

  useLayoutEffect(() => {
    const liste = listeRef.current;
    if (!liste) return;

    function mesurer() {
      const actif =
        liste?.querySelector<HTMLElement>(
          '[data-slot="tabs-trigger"][data-state="active"]',
        ) ?? null;
      if (!actif) return;
      setIndicateur({ left: actif.offsetLeft, width: actif.offsetWidth });
      setPret(true);
    }

    mesurer();
    const observer = new ResizeObserver(mesurer);
    observer.observe(liste);
    return () => observer.disconnect();
  }, [valeur]);

  return (
    <div className="flex flex-col gap-5">
      <div className="flex shrink-0 justify-end">
        <Tabs value={valeur} onValueChange={onChange}>
          <TabsList
            ref={listeRef}
            className="relative h-8 border border-border/70 bg-muted/90 shadow-inner"
          >
            <span
              aria-hidden
              className={cn(
                "pointer-events-none absolute top-[3px] h-7 rounded-md bg-white shadow-sm",
                pret
                  ? "transition-[left,width] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]"
                  : "transition-none",
              )}
              style={{ left: indicateur.left, width: indicateur.width }}
            />
            {onglets.map((onglet) => (
              <TabsTrigger
                key={onglet.value}
                value={onglet.value}
                className={CLASSE_ONGLET}
              >
                <onglet.icon />
                {onglet.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      </div>

      <div
        key={valeur}
        className={cn(
          "animate-in fade-in-0 duration-300 ease-out",
          versLaDroite ? "slide-in-from-right-4" : "slide-in-from-left-4",
        )}
      >
        {children}
      </div>
    </div>
  );
}

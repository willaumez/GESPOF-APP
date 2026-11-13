import { useId } from "react";

/**
 * Motif guilloché (projet Courrier / DESIGN §9.15) : figures SVG décoratives
 * derrière la barre latérale. Masqué aux lecteurs d'écran.
 */
export function Guilloche({ opacite = 0.08 }: { opacite?: number }) {
  const id = `guilloche-${useId().replace(/:/g, "")}`;
  const coins: Array<[number, number]> = [
    [0, 0],
    [120, 0],
    [0, 120],
    [120, 120],
  ];
  const cotes: Array<[number, number]> = [
    [60, 0],
    [0, 60],
    [120, 60],
    [60, 120],
  ];

  return (
    <svg
      aria-hidden
      focusable="false"
      className="pointer-events-none absolute inset-0 size-full"
      style={{ opacity: opacite }}
    >
      <defs>
        <pattern id={id} width="120" height="120" patternUnits="userSpaceOnUse">
          <g fill="none" stroke="#D9C38A" strokeWidth="0.6">
            {[54, 46, 38].map((r) => (
              <circle key={`c${r}`} cx="60" cy="60" r={r} />
            ))}
            {coins.flatMap(([x, y]) =>
              [54, 46].map((r) => (
                <circle key={`k${x}-${y}-${r}`} cx={x} cy={y} r={r} />
              )),
            )}
            {cotes.map(([x, y]) => (
              <circle key={`s${x}-${y}`} cx={x} cy={y} r={30} />
            ))}
          </g>
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill={`url(#${id})`} />
    </svg>
  );
}

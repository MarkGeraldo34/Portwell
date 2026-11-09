import type { ReactNode } from "react";

// Warp tunnel background, modelled on Magic UI's <WarpBackground> (MIT). Pure CSS (see globals.css),
// no dependencies. Pass children to wrap content, or mount it with no children as a page backdrop.

const BEAMS = [
  { x: 1, d: 0, t: 4.2, c: "#d92f54" },
  { x: 4, d: 1.3, t: 5.5, c: "#3b78ff" },
  { x: 7, d: 2.6, t: 4.8, c: "#2fd6e8" },
  { x: 10, d: 0.7, t: 6, c: "#d92f54" },
  { x: 13, d: 3.1, t: 5, c: "#3b78ff" },
  { x: 16, d: 1.9, t: 4.5, c: "#2fd6e8" },
];

function Face({ side }: { side: "top" | "bottom" | "left" | "right" }) {
  return (
    <div className={`warp-face warp-${side}`}>
      {BEAMS.map((b, i) => (
        <span
          key={i}
          className="warp-beam"
          style={{ left: `calc(var(--warp-cell) * ${b.x + (side === "left" || side === "bottom" ? 1 : 0)})`, animationDelay: `${b.d}s`, animationDuration: `${b.t}s`, ["--beam" as string]: b.c }}
        />
      ))}
    </div>
  );
}

export function WarpBackground({ children, fixed = false }: { children?: ReactNode; fixed?: boolean }) {
  return (
    <div className={fixed ? "warp warp-fixed" : "warp"} aria-hidden={children ? undefined : true}>
      <div className="warp-scene" aria-hidden="true">
        <Face side="top" />
        <Face side="bottom" />
        <Face side="left" />
        <Face side="right" />
      </div>
      {children && <div className="warp-content">{children}</div>}
    </div>
  );
}

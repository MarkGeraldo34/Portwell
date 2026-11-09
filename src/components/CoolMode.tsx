"use client";

import { cloneElement, isValidElement, useEffect, useRef, type ReactElement } from "react";

// Click particle burst, modelled on Magic UI's "Cool Mode" (MIT). Written without the shadcn registry so
// it has no extra dependencies. Particles use the PORTWELL logo colours.

const COLORS = ["#d92f54", "#3b78ff", "#2fd6e8", "#ff6b8a", "#8fb8ff"];

interface Particle {
  el: HTMLDivElement;
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
}

/** Spawn a burst of particles at viewport coordinates (x, y). */
export function burst(x: number, y: number, count = 14): void {
  if (typeof document === "undefined") return;
  const layer = document.createElement("div");
  layer.style.cssText = "position:fixed;inset:0;pointer-events:none;z-index:2147483647;overflow:hidden";
  document.body.appendChild(layer);

  const parts: Particle[] = Array.from({ length: count }, () => {
    const size = 5 + Math.random() * 7;
    const el = document.createElement("div");
    el.style.cssText = `position:absolute;left:0;top:0;width:${size}px;height:${size}px;border-radius:50%;background:${
      COLORS[Math.floor(Math.random() * COLORS.length)]
    };will-change:transform,opacity`;
    layer.appendChild(el);
    const angle = Math.random() * Math.PI * 2;
    const speed = 2 + Math.random() * 5;
    return { el, x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed - 3, life: 1 };
  });

  const tick = () => {
    let alive = 0;
    for (const p of parts) {
      if (p.life <= 0) continue;
      p.vy += 0.25; // gravity
      p.x += p.vx;
      p.y += p.vy;
      p.life -= 0.022;
      if (p.life > 0) {
        alive++;
        p.el.style.transform = `translate(${p.x}px,${p.y}px) scale(${p.life})`;
        p.el.style.opacity = String(Math.min(1, p.life * 1.5));
      } else {
        p.el.remove();
      }
    }
    if (alive > 0) requestAnimationFrame(tick);
    else layer.remove();
  };
  requestAnimationFrame(tick);
}

/** Wrap a single element: clicking it bursts particles. Same usage as Magic UI's <CoolMode>. */
export function CoolMode({ children }: { children: ReactElement<{ ref?: unknown }> }) {
  const ref = useRef<HTMLElement | null>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const onClick = (e: MouseEvent) => burst(e.clientX, e.clientY);
    el.addEventListener("click", onClick);
    return () => el.removeEventListener("click", onClick);
  }, []);
  if (!isValidElement(children)) return children;
  return cloneElement(children, { ref } as object);
}

/** Mount once in the layout: every enabled button on the site gets the effect. */
export function CoolModeEverywhere() {
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      const btn = (e.target as Element | null)?.closest?.("button, .btn, .post-cta");
      if (!btn || (btn as HTMLButtonElement).disabled) return;
      // Keyboard "clicks" report 0,0: burst from the button's centre instead.
      const n = btn.classList.contains("post-cta") ? 26 : 14; // Subscribe gets a bigger burst
      if (e.clientX === 0 && e.clientY === 0) {
        const r = btn.getBoundingClientRect();
        burst(r.left + r.width / 2, r.top + r.height / 2, n);
      } else burst(e.clientX, e.clientY, n);
    };
    document.addEventListener("click", onClick, true); // capture: still fires if a component stops propagation
    return () => document.removeEventListener("click", onClick, true);
  }, []);
  return null;
}

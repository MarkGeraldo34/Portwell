import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

/**
 * Card with an animated gradient rim and a frosted surface, in the site's own colours (coral red, electric blue, cyan).
 * Plain CSS (see `.halo` in globals.css): the project does not use Tailwind. The rim brightens on hover or keyboard
 * focus inside the card and stands still for people who prefer reduced motion.
 */
export function HaloCard({ className, children, ...props }: HTMLAttributes<HTMLElement>) {
  return (
    <section className={cn("halo", className)} {...props}>
      <div className="halo-surface">{children}</div>
    </section>
  );
}

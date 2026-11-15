"use client";

import { useRef, type ReactNode } from "react";
import { motion, useInView, useReducedMotion, type MotionProps, type UseInViewOptions, type Variants } from "motion/react";

type MarginType = UseInViewOptions["margin"];

interface BlurFadeProps extends Omit<MotionProps, "children"> {
  children: ReactNode;
  className?: string;
  duration?: number;
  delay?: number;
  /** How far (px) it travels while appearing. */
  offset?: number;
  direction?: "up" | "down" | "left" | "right";
  /** true: play when scrolled into view. false: play on mount. */
  inView?: boolean;
  inViewMargin?: MarginType;
  blur?: string;
  /** Render as a list item when the parent is a <ul>. */
  as?: "div" | "li";
}

/**
 * Scroll-in animation: the content fades in from a blur while sliding a few pixels.
 * Plays once. People who prefer reduced motion get the content with no animation.
 * The blur filter is removed after the animation, because a leftover filter would stop the cards' own glass blur.
 */
export function BlurFade({
  children,
  className,
  duration = 0.4,
  delay = 0,
  offset = 6,
  direction = "down",
  inView = false,
  inViewMargin = "-50px",
  blur = "6px",
  as = "div",
  ...props
}: BlurFadeProps) {
  const ref = useRef<HTMLDivElement & HTMLLIElement>(null);
  const seen = useInView(ref, { once: true, margin: inViewMargin });
  const calm = useReducedMotion();
  if (calm) return as === "li" ? <li className={className}>{children}</li> : <div className={className}>{children}</div>;
  const Tag = as === "li" ? motion.li : motion.div;

  const axis = direction === "left" || direction === "right" ? "x" : "y";
  const from = direction === "right" || direction === "down" ? -offset : offset;
  const variants: Variants = {
    hidden: { [axis]: from, opacity: 0, filter: `blur(${blur})` },
    visible: { [axis]: 0, opacity: 1, filter: "blur(0px)" },
  };
  const show = !inView || seen;

  return (
    <Tag
      ref={ref}
      initial="hidden"
      animate={show ? "visible" : "hidden"}
      variants={variants}
      transition={{ delay: 0.04 + delay, duration, ease: "easeOut" }}
      onAnimationComplete={(def) => {
        if (def === "visible" && ref.current) ref.current.style.filter = "none";
      }}
      className={className}
      {...props}
    >
      {children}
    </Tag>
  );
}

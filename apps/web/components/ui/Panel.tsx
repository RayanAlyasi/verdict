import type { HTMLAttributes, ReactNode } from "react";

const TONES = {
  default: "rounded-card border-panel-border bg-panel p-4",
  // Tinted callouts for a state (ready, needs attention, wrong): tighter than a card, as designed.
  glow: "rounded-lg border-glow-border bg-glow/8 px-4 py-3",
  amber: "rounded-row border-amber-border bg-amber/7 px-4 py-3",
  coral: "rounded-row border-coral-border bg-coral/8 px-4 py-3",
};

// A solid card for content on the space background.
export function Panel({
  tone = "default",
  as: Tag = "div",
  className = "",
  children,
  ...props
}: HTMLAttributes<HTMLElement> & {
  tone?: keyof typeof TONES;
  as?: "div" | "section" | "article" | "aside";
  children: ReactNode;
}) {
  return (
    <Tag {...props} className={`flex flex-col gap-3 border ${TONES[tone]} ${className}`}>
      {children}
    </Tag>
  );
}

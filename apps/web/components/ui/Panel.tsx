import type { HTMLAttributes, ReactNode } from "react";

const TONES = {
  default: "border-panel-border bg-panel",
  // Tinted surfaces for a state: ready, needs attention, wrong.
  glow: "border-glow-border bg-glow/8",
  amber: "border-amber-border bg-amber/7",
  coral: "border-coral-border bg-coral/8",
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
    <Tag
      {...props}
      className={`flex flex-col gap-3 rounded-card border p-4 ${TONES[tone]} ${className}`}
    >
      {children}
    </Tag>
  );
}

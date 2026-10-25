"use client";

import type { ReactNode } from "react";
import { Button as AriaButton, type ButtonProps as AriaButtonProps } from "react-aria-components";
import { Spinner } from "./Button";
import { disabled, focusRing, hoverLayer, pressable } from "./styles";

const VARIANTS = {
  ghost: "text-text before:bg-text/8",
  outline: "border border-panel-border-strong bg-panel text-text before:bg-text/8",
};

export type IconButtonProps = Omit<AriaButtonProps, "children" | "className" | "aria-label"> & {
  // The icon has no words, so the label is what screen readers announce.
  label: string;
  // An SVG marked aria-hidden; one with a direction (an arrow) needs rtl:-scale-x-100.
  children: ReactNode;
  variant?: keyof typeof VARIANTS;
  pendingLabel?: string;
  className?: string;
};

export function IconButton({
  label,
  children,
  variant = "ghost",
  pendingLabel,
  className = "",
  ...props
}: IconButtonProps) {
  return (
    <AriaButton
      {...props}
      aria-label={label}
      className={[
        "group relative inline-grid size-11 shrink-0 select-none place-items-center rounded-pill",
        VARIANTS[variant],
        pressable,
        focusRing,
        hoverLayer,
        disabled,
        className,
      ].join(" ")}
    >
      {({ isPending }) => (
        <>
          <span className="relative grid size-6 place-items-center group-data-pending:opacity-0">
            {children}
          </span>
          {isPending && <Spinner label={pendingLabel} />}
        </>
      )}
    </AriaButton>
  );
}

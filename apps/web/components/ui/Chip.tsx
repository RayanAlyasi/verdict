"use client";

import type { ReactNode } from "react";
import { ToggleButton, type ToggleButtonProps } from "react-aria-components";
import { disabled, focusRing, hoverLayer, pressable } from "./styles";

export type ChipProps = Omit<ToggleButtonProps, "children" | "className"> & {
  children: ReactNode;
  className?: string;
};

// A filter or choice that turns on and off. The border is always 1.5px, so selecting one doesn't
// shift the row.
export function Chip({ children, className = "", ...props }: ChipProps) {
  return (
    <ToggleButton
      {...props}
      className={[
        "relative inline-flex h-11 select-none items-center gap-2 whitespace-nowrap rounded-pill border-[1.5px] border-control-border px-4 text-label font-medium text-text-muted before:bg-text/8",
        "data-selected:border-glow data-selected:bg-glow/12 data-selected:font-semibold data-selected:text-text",
        // The selected glow is drawn once and faded in.
        "after:pointer-events-none after:absolute after:inset-0 after:rounded-[inherit] after:opacity-0 after:shadow-glow-soft after:transition-opacity after:duration-base data-selected:after:opacity-100 motion-reduce:after:transition-none",
        pressable,
        focusRing,
        hoverLayer,
        disabled,
        className,
      ].join(" ")}
    >
      {children}
    </ToggleButton>
  );
}

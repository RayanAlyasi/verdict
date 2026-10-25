"use client";

import type { ReactNode } from "react";
import {
  Button as AriaButton,
  type ButtonProps as AriaButtonProps,
  ProgressBar,
} from "react-aria-components";
import { disabled, focusRing, hoverLayer, pressable } from "./styles";

const VARIANTS = {
  // The glow sits on its own layer, so the pulse fades it instead of animating box-shadow.
  primary:
    "bg-glow font-bold text-space-900 before:bg-text/15 after:pointer-events-none after:absolute after:inset-0 after:rounded-[inherit] after:shadow-glow-primary after:opacity-60",
  secondary: "border-[1.5px] border-control-border font-semibold text-text before:bg-text/8",
  ghost: "font-semibold text-glow before:bg-glow/10",
};

const SIZES = {
  lg: "h-14 text-body",
  md: "h-12 text-small",
  sm: "h-11 text-label",
};

const PADDING = { lg: "px-8", md: "px-6", sm: "px-4" };

// A button that can wait says what it's waiting for: without a label the spinner has no name.
export type PendingProps =
  { isPending?: false; pendingLabel?: undefined } | { isPending: boolean; pendingLabel: string };

export type ButtonProps = Omit<AriaButtonProps, "children" | "className" | "isPending"> &
  PendingProps & {
    children: ReactNode;
    variant?: keyof typeof VARIANTS;
    size?: keyof typeof SIZES;
    // The screen's one main action pulses softly (primary only).
    pulse?: boolean;
    className?: string;
  };

export function Button({
  children,
  variant = "primary",
  size = "md",
  pulse = false,
  pendingLabel,
  className = "",
  ...props
}: ButtonProps) {
  return (
    <AriaButton
      {...props}
      className={[
        "group relative inline-flex min-w-11 select-none items-center justify-center gap-2 whitespace-nowrap rounded-pill",
        VARIANTS[variant],
        SIZES[size],
        // A ghost button's text lines up with the content beside it.
        variant === "ghost" ? "px-1" : PADDING[size],
        pulse && variant === "primary"
          ? "after:animate-glow-pulse motion-reduce:after:animate-none"
          : "",
        pressable,
        focusRing,
        hoverLayer,
        disabled,
        className,
      ].join(" ")}
    >
      {({ isPending }) => (
        <>
          {/* Hidden by opacity, not removed, so the button keeps its size while it waits. */}
          <span className="relative inline-flex items-center gap-2 group-data-pending:opacity-0">
            {children}
          </span>
          {isPending && <Spinner label={pendingLabel} />}
        </>
      )}
    </AriaButton>
  );
}

// Inside the button while it waits; React Aria announces the pending state through it.
export function Spinner({ label }: { label: string | undefined }) {
  return (
    <ProgressBar
      isIndeterminate
      aria-label={label}
      className="absolute inset-0 grid place-items-center"
    >
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        className="size-5 animate-spin motion-reduce:animate-pulse"
        fill="none"
      >
        <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity="0.3" strokeWidth="3" />
        <path
          d="M21 12a9 9 0 0 0-9-9"
          stroke="currentColor"
          strokeWidth="3"
          strokeLinecap="round"
        />
      </svg>
    </ProgressBar>
  );
}

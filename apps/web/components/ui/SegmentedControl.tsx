"use client";

import type { ReactNode } from "react";
import {
  type Key,
  SelectionIndicator,
  ToggleButton,
  ToggleButtonGroup,
  type ToggleButtonGroupProps,
} from "react-aria-components";
import { disabled, focusRing, hoverLayer, pressable } from "./styles";

export type SegmentedControlProps<K extends Key> = Omit<
  ToggleButtonGroupProps,
  | "children"
  | "className"
  | "selectionMode"
  | "selectedKeys"
  | "defaultSelectedKeys"
  | "onSelectionChange"
> & {
  // Names the choice for screen readers, for example "Explain it".
  "aria-label": string;
  options: { id: K; label: ReactNode }[];
  selected?: K;
  defaultSelected?: K;
  onChange?: (id: K) => void;
  className?: string;
};

// One of a few views, always exactly one selected (Simply / In depth / Revision).
export function SegmentedControl<K extends Key>({
  options,
  selected,
  defaultSelected,
  onChange,
  className = "",
  ...props
}: SegmentedControlProps<K>) {
  return (
    <ToggleButtonGroup
      {...props}
      selectionMode="single"
      disallowEmptySelection
      selectedKeys={selected === undefined ? undefined : [selected]}
      defaultSelectedKeys={defaultSelected === undefined ? undefined : [defaultSelected]}
      onSelectionChange={(keys) => {
        const [key] = keys;
        if (key !== undefined) onChange?.(key as K);
      }}
      className={`flex items-center gap-1 rounded-pill border border-panel-border bg-input p-1 ${className}`}
    >
      {options.map((option) => (
        <ToggleButton
          key={option.id}
          id={option.id}
          className={[
            "relative h-10 min-w-0 flex-1 select-none rounded-pill px-4 text-label font-medium text-text-muted before:bg-text/8",
            "data-selected:font-bold data-selected:text-space-900",
            // The touch target reaches the group's edges: 48px tall, with the 40px segment inside.
            "after:absolute after:-inset-y-1 after:inset-x-0",
            pressable,
            focusRing,
            hoverLayer,
            disabled,
          ].join(" ")}
        >
          {/* Slides to the selected segment with translate, a transform. */}
          <SelectionIndicator className="absolute inset-0 rounded-pill bg-glow transition-[translate] duration-base ease-standard motion-reduce:transition-none" />
          <span className="relative block truncate">{option.label}</span>
        </ToggleButton>
      ))}
    </ToggleButtonGroup>
  );
}

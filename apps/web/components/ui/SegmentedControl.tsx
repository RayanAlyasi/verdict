"use client";

import { type ReactNode, useState } from "react";
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
  onChange?: (id: K) => void;
  className?: string;
} & ({ selected: K; defaultSelected?: never } | { selected?: never; defaultSelected: K });

// One of a few views, always exactly one selected (Simply / In depth / Revision).
export function SegmentedControl<K extends Key>({
  options,
  selected,
  defaultSelected,
  onChange,
  className = "",
  ...props
}: SegmentedControlProps<K>) {
  const [chosen, setChosen] = useState(defaultSelected);
  const current = selected ?? chosen;
  return (
    <ToggleButtonGroup
      {...props}
      selectionMode="single"
      disallowEmptySelection
      selectedKeys={current === undefined ? [] : [current]}
      onSelectionChange={(keys) => {
        const [key] = keys as Set<K>;
        // React Aria reports a press on the selected segment as a change to the same key.
        if (key === undefined || key === current) return;
        setChosen(key);
        onChange?.(key);
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

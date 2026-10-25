"use client";

import type { ReactNode } from "react";
import { ProgressBar } from "react-aria-components";
import { Light } from "./Light";

// Progress through a short run, such as a session's questions: one light per item, done ones
// lit, the current one ringed. Screen readers hear it as a progress bar: "Session progress,
// Question 4 of 10".
export function ProgressLights({
  name,
  label,
  shortLabel,
  layout = "stacked",
  completed,
  total,
  showCurrent = true,
  className = "",
}: {
  // What it measures, for example "Session progress".
  name: string;
  // Where it's at, for example "Question 4 of 10": shown above the lights, and read as the value.
  label: string;
  // Shown after the lights in the inline layout, for example "4 of 10".
  shortLabel?: string;
  // Stacked (phones): the label above the lights. Inline (desktop): the lights, then the short label.
  layout?: "stacked" | "inline";
  completed: number;
  total: number;
  // Rings the light after the completed ones, for the item in progress.
  showCurrent?: boolean;
  className?: string;
}): ReactNode {
  const caption = layout === "stacked" ? label : (shortLabel ?? label);
  return (
    <ProgressBar
      aria-label={name}
      value={completed}
      maxValue={total}
      valueLabel={label}
      className={`flex items-center gap-1.5 ${layout === "stacked" ? "flex-col" : "flex-row-reverse justify-end gap-2.5"} ${className}`}
    >
      {/* The value is read from valueLabel, so the visible words aren't read a second time. */}
      <span aria-hidden="true" className="text-caption font-normal text-text-faint tabular-nums">
        {caption}
      </span>
      <span className="flex flex-wrap justify-center gap-1.5">
        {Array.from({ length: total }, (_, index) => (
          <Light
            key={index}
            status={
              index < completed
                ? "mastered"
                : index === completed && showCurrent
                  ? "current"
                  : "not-started"
            }
          />
        ))}
      </span>
    </ProgressBar>
  );
}

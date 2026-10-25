"use client";

import type { ReactNode } from "react";
import { Label, ProgressBar } from "react-aria-components";
import { Light } from "./Light";

// Progress through a short run, such as a session's questions: one light per item, done ones
// lit, the current one ringed. The caption says it in words, and screen readers hear it as a
// progress bar ("Question 4 of 10").
export function ProgressLights({
  label,
  completed,
  total,
  showCurrent = true,
  className = "",
}: {
  // Shown above the lights and read as the bar's value, for example "Question 4 of 10".
  label: string;
  completed: number;
  total: number;
  // Rings the light after the completed ones, for the item in progress.
  showCurrent?: boolean;
  className?: string;
}): ReactNode {
  return (
    <ProgressBar
      value={completed}
      maxValue={total}
      valueLabel={label}
      className={`flex flex-col items-center gap-2 ${className}`}
    >
      <Label className="text-caption text-text-faint tabular-nums">{label}</Label>
      <span className="flex flex-wrap justify-center gap-2">
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

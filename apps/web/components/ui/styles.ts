// Shared by the interactive components, so every one has the same states (docs/UX-GUIDELINES.md).

export const focusRing =
  "outline-offset-2 data-focus-visible:outline-2 data-focus-visible:outline-focus";

// Scales to 0.97 while pressed. A transform, so it stays smooth.
export const pressable =
  "transition-transform duration-press ease-standard data-pressed:scale-97 motion-reduce:transition-none";

// A tint layer that fades in on hover (pointer devices only: React Aria never sets data-hovered
// for touch). Fading a layer animates only opacity, where changing the background would repaint.
export const hoverLayer =
  "before:pointer-events-none before:absolute before:inset-0 before:rounded-[inherit] before:opacity-0 before:transition-opacity before:duration-fast data-hovered:before:opacity-100 motion-reduce:before:transition-none";

export const disabled = "data-disabled:opacity-40";

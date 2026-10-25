export type LightStatus = "mastered" | "progress" | "not-started" | "current";

// Each lit state has its fill and glow on a layer of its own, drawn once; a change of state fades
// the layers' opacity, so a topic's light turning green is a crossfade, not a repaint.
const STATUS: Record<LightStatus, string> = {
  mastered: "after:opacity-100",
  progress: "before:opacity-100",
  "not-started": "",
  current: "border-2 border-text bg-transparent shadow-light-current",
};

const SIZES = { md: "size-2.5", sm: "size-2" };

// A small glowing dot for a topic or question's state. Decorative: always put it next to the word
// it stands for ("Mastered", "In progress"), which screen readers read instead.
export function Light({
  status,
  size = "md",
  className = "",
}: {
  status: LightStatus;
  size?: keyof typeof SIZES;
  className?: string;
}) {
  return (
    <span
      aria-hidden="true"
      data-status={status}
      className={[
        "relative inline-block shrink-0 rounded-pill bg-dim",
        "before:absolute before:inset-0 before:rounded-[inherit] before:bg-amber before:opacity-0 before:shadow-light-progress",
        "after:absolute after:inset-0 after:rounded-[inherit] after:bg-glow after:opacity-0 after:shadow-light-mastered",
        "before:transition-opacity before:duration-base after:transition-opacity after:duration-base motion-reduce:before:transition-none motion-reduce:after:transition-none",
        SIZES[size],
        STATUS[status],
        className,
      ].join(" ")}
    />
  );
}

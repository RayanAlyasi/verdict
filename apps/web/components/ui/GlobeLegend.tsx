import { Light } from "./Light";

// What the globe's lights mean, in words, for everyone and for screen readers: the canvas itself
// is hidden from them. Pair the globe with this and a plain-language line.
export function GlobeLegend({
  caption,
  mastered,
  progress,
  notStarted,
}: {
  caption: string;
  mastered: string;
  progress: string;
  notStarted: string;
}) {
  return (
    <div className="flex flex-col items-center gap-2 text-center">
      <p className="text-caption text-text-faint">{caption}</p>
      <ul className="flex flex-wrap justify-center gap-x-4 gap-y-1 text-note text-text-muted">
        <li className="flex items-center gap-2">
          <Light status="mastered" size="sm" />
          {mastered}
        </li>
        <li className="flex items-center gap-2">
          <Light status="progress" size="sm" />
          {progress}
        </li>
        <li className="flex items-center gap-2">
          <Light status="not-started" size="sm" />
          {notStarted}
        </li>
      </ul>
    </div>
  );
}

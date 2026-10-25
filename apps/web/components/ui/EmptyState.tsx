import type { ReactNode } from "react";

// What's missing and the one step that fills it ("No courses yet. Add your first course.").
export function EmptyState({
  icon,
  title,
  description,
  action,
  headingLevel = 2,
  className = "",
}: {
  // An SVG marked aria-hidden.
  icon?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  // Usually one Button.
  action?: ReactNode;
  headingLevel?: 2 | 3;
  className?: string;
}) {
  const Heading = headingLevel === 2 ? "h2" : "h3";
  return (
    <div className={`flex flex-col items-center gap-3 px-4 py-8 text-center ${className}`}>
      {icon && (
        <span className="grid size-14 place-items-center rounded-pill border border-glow-border bg-glow/8 text-glow">
          {icon}
        </span>
      )}
      <Heading className="text-title-3">{title}</Heading>
      {description && <p className="max-w-sm text-note text-text-muted">{description}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

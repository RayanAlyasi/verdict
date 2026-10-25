// A placeholder in the shape of content on its way; size it with className. The region that holds
// it says it's loading (aria-busy and a short status message), so skeletons stay out of the
// accessibility tree. Pulses its opacity, and holds still with reduced motion.
export function Skeleton({ className = "" }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={`block animate-pulse rounded-md bg-panel-border motion-reduce:animate-none ${className}`}
    />
  );
}

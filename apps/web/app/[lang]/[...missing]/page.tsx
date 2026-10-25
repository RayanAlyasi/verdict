import { notFound } from "next/navigation";

// An unknown address below a language gets that language's 404 page (../not-found.tsx). Without
// this, it matches no route and Next.js answers with its own page, outside the layout.
export default function Missing() {
  notFound();
}

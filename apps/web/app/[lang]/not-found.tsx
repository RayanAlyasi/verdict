import { Trans } from "@lingui/react/macro";
import { initLingui } from "@/lib/i18n";

export default async function NotFound() {
  const { locale } = await initLingui();
  return (
    <main className="grid min-h-dvh place-content-center justify-items-center gap-4 p-6 text-center">
      <h1 className="text-title-2">
        <Trans>We couldn&apos;t find this page.</Trans>
      </h1>
      <a
        href={`/${locale}`}
        className="inline-flex min-h-touch-target items-center rounded-sm px-2 text-body-strong text-glow underline-offset-4 transition-opacity hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus active:opacity-70 motion-reduce:transition-none"
      >
        <Trans>Go to the home page</Trans>
      </a>
    </main>
  );
}

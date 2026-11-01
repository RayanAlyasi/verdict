import { msg } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { Globe } from "@/components/ui/Globe";
import { GlobeLegend } from "@/components/ui/GlobeLegend";
import { initLingui } from "@/lib/i18n";
import { pageMetadata } from "./placeholder";

export const generateMetadata = () => pageMetadata("/", msg`Today`);

// With no course yet the globe is dark: no made-up mastery. Spec 001 fills this page in.
export default async function Today() {
  const { i18n, locale } = await initLingui();
  // The words come first for screen readers. On phones both columns dissolve, and order puts the
  // page in the design's sequence.
  return (
    <div className="mx-auto flex max-w-299 flex-col items-center gap-6 px-4 py-6 text-center sm:px-8 lg:flex-row-reverse lg:gap-12 lg:px-12 lg:py-10 lg:text-start">
      <div className="contents lg:flex lg:flex-1 lg:flex-col lg:items-start lg:gap-4">
        <h1 className="order-1 text-title-1 lg:order-none">
          <Trans>Today</Trans>
        </h1>
        <p className="order-3 max-w-md text-body text-text-muted lg:order-none">
          <Trans>No course yet. Add one and its ideas appear here as lights.</Trans>
        </p>
        {/* Stays in reach above the navigation when the page is taller than the screen. */}
        <div className="sticky bottom-[calc(var(--bottom-nav-height)+--spacing(4))] z-1 order-5 lg:static lg:order-none lg:mt-2">
          <ButtonLink
            href={`/${locale}/add-course`}
            pendingLabel={i18n._(msg`Opening`)}
            size="lg"
            pulse
          >
            <Trans>Add a course</Trans>
          </ButtonLink>
        </div>
      </div>
      <div className="contents lg:flex lg:flex-1 lg:flex-col lg:items-center lg:gap-4">
        <Globe
          mastered={0}
          inProgress={0}
          className="order-2 max-w-[min(20.5rem,45dvh)] lg:order-none lg:max-w-120"
        />
        <div className="order-4 lg:order-none">
          <GlobeLegend
            caption={i18n._(msg`Each light is one idea from your course`)}
            mastered={i18n._(msg`Mastered`)}
            progress={i18n._(msg`In progress`)}
            notStarted={i18n._(msg`Not started`)}
          />
        </div>
      </div>
    </div>
  );
}

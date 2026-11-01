import { msg } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { CourseIcon } from "@/components/ui/icons";
import { initLingui } from "@/lib/i18n";
import { pageMetadata, Placeholder } from "../placeholder";

export const generateMetadata = () => pageMetadata("/course", msg`Course`);

export default async function CoursePage() {
  const { i18n, locale } = await initLingui();
  return (
    <Placeholder
      title={<Trans>Course</Trans>}
      emptyTitle={<Trans>No course yet.</Trans>}
      description={<Trans>Your topics and sources will show here once you add a course.</Trans>}
      icon={<CourseIcon className="size-6" />}
      action={
        <ButtonLink href={`/${locale}/add-course`} pendingLabel={i18n._(msg`Opening`)}>
          <Trans>Add a course</Trans>
        </ButtonLink>
      }
    />
  );
}

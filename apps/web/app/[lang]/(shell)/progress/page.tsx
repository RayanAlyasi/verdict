import { Trans } from "@lingui/react/macro";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { ProgressIcon } from "@/components/ui/icons";
import { initLingui } from "@/lib/i18n";
import { Placeholder, placeholderMetadata } from "../placeholder";

export const generateMetadata = () => placeholderMetadata("/progress");

export default async function ProgressPage() {
  const { locale } = await initLingui();
  return (
    <Placeholder
      title={<Trans>Progress</Trans>}
      emptyTitle={<Trans>No course yet.</Trans>}
      description={
        <Trans>Your mastery, topic by topic, will show here once you add a course.</Trans>
      }
      icon={<ProgressIcon className="size-6" />}
      action={
        <ButtonLink href={`/${locale}/add-course`}>
          <Trans>Add a course</Trans>
        </ButtonLink>
      }
    />
  );
}

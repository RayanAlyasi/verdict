import { Trans } from "@lingui/react/macro";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { PracticeIcon } from "@/components/ui/icons";
import { initLingui } from "@/lib/i18n";
import { Placeholder, placeholderMetadata } from "../placeholder";

export const generateMetadata = () => placeholderMetadata("/practice");

export default async function PracticePage() {
  const { locale } = await initLingui();
  return (
    <Placeholder
      title={<Trans>Practice</Trans>}
      emptyTitle={<Trans>No course yet.</Trans>}
      description={<Trans>Practice exams and quizzes will show here once you add a course.</Trans>}
      icon={<PracticeIcon className="size-6" />}
      action={
        <ButtonLink href={`/${locale}/add-course`}>
          <Trans>Add a course</Trans>
        </ButtonLink>
      }
    />
  );
}

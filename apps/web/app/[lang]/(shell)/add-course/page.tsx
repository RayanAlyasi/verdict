import { Trans } from "@lingui/react/macro";
import { PlusIcon } from "@/components/ui/icons";
import { initLingui } from "@/lib/i18n";
import { Placeholder, placeholderMetadata } from "../placeholder";

export const generateMetadata = () => placeholderMetadata("/add-course");

export default async function AddCoursePage() {
  await initLingui();
  return (
    <Placeholder
      title={<Trans>Add a course</Trans>}
      emptyTitle={<Trans>Not here yet.</Trans>}
      description={
        <Trans>Soon you can add a course here, with your slides, notes and past exams.</Trans>
      }
      icon={<PlusIcon className="size-6" />}
    />
  );
}

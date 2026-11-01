import { msg } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import { PlusIcon } from "@/components/ui/icons";
import { initLingui } from "@/lib/i18n";
import { pageMetadata, Placeholder } from "../placeholder";

export const generateMetadata = () => pageMetadata("/add-course", msg`Add a course`);

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

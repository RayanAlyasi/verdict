import { msg } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import { AskIcon } from "@/components/ui/icons";
import { initLingui } from "@/lib/i18n";
import { pageMetadata, Placeholder } from "../placeholder";

export const generateMetadata = () => pageMetadata("/ask", msg`Ask Verdict`);

export default async function AskPage() {
  await initLingui();
  return (
    <Placeholder
      title={<Trans>Ask Verdict</Trans>}
      emptyTitle={<Trans>Not here yet.</Trans>}
      description={
        <Trans>
          Soon you can ask anything about your course here, and get answers from your own materials.
        </Trans>
      }
      icon={<AskIcon className="size-6" />}
    />
  );
}

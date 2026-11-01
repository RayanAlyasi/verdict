import { msg } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import { ProfileIcon } from "@/components/ui/icons";
import { initLingui } from "@/lib/i18n";
import { pageMetadata, Placeholder } from "../placeholder";

export const generateMetadata = () => pageMetadata("/profile", msg`Profile and settings`);

export default async function ProfilePage() {
  await initLingui();
  return (
    <Placeholder
      title={<Trans>Profile and settings</Trans>}
      emptyTitle={<Trans>Not here yet.</Trans>}
      description={<Trans>Your account and settings will show here once sign-in is ready.</Trans>}
      icon={<ProfileIcon className="size-6" />}
    />
  );
}

import { msg } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import type { Metadata } from "next";
import { Input } from "@/components/ui/Input";
import { Toasts } from "@/components/ui/Toast";
import { initLingui } from "@/lib/i18n";
import { alternates } from "@/lib/locales";
import { Section, showGalleryOrNotFound } from "../gallery";
import { SheetDemo } from "../SheetDemo";
import { ToastDemo } from "../ToastDemo";

export async function generateMetadata(): Promise<Metadata> {
  const { locale } = await initLingui();
  return { robots: { index: false }, alternates: alternates(locale, "/dev/ui/overlays") };
}

// Toasts and sheets, which open on a press.
export default async function OverlayGallery() {
  await showGalleryOrNotFound();
  const { i18n } = await initLingui();
  const close = i18n._(msg`Close`);

  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-8 p-6">
      <h1 className="text-title-1">
        <Trans>Toasts and sheets</Trans>
      </h1>
      <Section title={<Trans>Try them</Trans>}>
        <ToastDemo
          samples={[
            {
              label: i18n._(msg`Show a confirmation`),
              toast: { title: i18n._(msg`Course saved.`), tone: "success" },
            },
            {
              label: i18n._(msg`Show a note`),
              toast: { title: i18n._(msg`Your plan now starts on Monday.`) },
            },
            {
              label: i18n._(msg`Show an error`),
              toast: {
                title: i18n._(msg`We couldn't save your course.`),
                description: i18n._(msg`Check your connection, then try again.`),
                tone: "error",
              },
            },
          ]}
        />
        <SheetDemo
          label={i18n._(msg`Change the exam date`)}
          title={<Trans>Exam date</Trans>}
          closeLabel={close}
          saveLabel={i18n._(msg`Save the date`)}
          loadErrorLabel={i18n._(
            msg`We couldn't open this. Check your connection, then try again.`,
          )}
        >
          <p className="text-note text-text-muted">
            <Trans>Your midterm is on 3 January. Your plan moves with it.</Trans>
          </p>
          <Input label={<Trans>Exam date</Trans>} defaultValue="2027-01-03" />
        </SheetDemo>
      </Section>
      <Toasts closeLabel={close} />
    </main>
  );
}

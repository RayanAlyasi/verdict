import { msg } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/Button";
import { Chip } from "@/components/ui/Chip";
import { IconButton } from "@/components/ui/IconButton";
import { Input } from "@/components/ui/Input";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { initLingui } from "@/lib/i18n";
import { alternates } from "@/lib/locales";

export async function generateMetadata(): Promise<Metadata> {
  const { locale } = await initLingui();
  return { robots: { index: false }, alternates: alternates(locale, "/dev/ui") };
}

// Every component in every state it can hold still, in both languages: this replaces a separate
// Storybook (spec 000). Hover, pressed and focus need a pointer or keyboard, and component tests
// cover them.
export default async function ComponentGallery() {
  await connection();
  if (!["development", "test", "staging"].includes(process.env.APP_ENV ?? "")) notFound();
  const { i18n } = await initLingui();
  const saving = i18n._(msg`Saving`);
  const close = i18n._(msg`Close`);

  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-8 p-6">
      <h1 className="text-title-1">
        <Trans>Components</Trans>
      </h1>

      <Section title={<Trans>Buttons</Trans>}>
        <Row>
          <Button size="lg" pulse>
            <Trans>Start today&apos;s session</Trans>
          </Button>
          <Button>
            <Trans>Continue</Trans>
          </Button>
          <Button size="sm">
            <Trans>Save</Trans>
          </Button>
        </Row>
        <Row>
          <Button variant="secondary">
            <Trans>Not now</Trans>
          </Button>
          <Button variant="ghost">
            <Trans>Skip this question</Trans>
          </Button>
        </Row>
        <Row>
          <Button isDisabled>
            <Trans>Continue</Trans>
          </Button>
          <Button variant="secondary" isDisabled>
            <Trans>Not now</Trans>
          </Button>
          <Button isPending pendingLabel={saving}>
            <Trans>Save</Trans>
          </Button>
          <Button variant="secondary" isPending pendingLabel={saving}>
            <Trans>Save</Trans>
          </Button>
        </Row>
      </Section>

      <Section title={<Trans>Icon buttons</Trans>}>
        <Row>
          <IconButton label={close}>
            <CloseIcon />
          </IconButton>
          <IconButton label={close} variant="outline">
            <CloseIcon />
          </IconButton>
          <IconButton label={close} variant="outline" isDisabled>
            <CloseIcon />
          </IconButton>
          <IconButton label={close} variant="outline" isPending pendingLabel={saving}>
            <CloseIcon />
          </IconButton>
        </Row>
      </Section>

      <Section title={<Trans>Chips</Trans>}>
        <Row>
          <Chip defaultSelected>
            <Trans>Prediction exam</Trans>
          </Chip>
          <Chip>
            <Trans>Topic drill</Trans>
          </Chip>
          <Chip isDisabled>
            <Trans>Past paper</Trans>
          </Chip>
          <Chip isDisabled defaultSelected>
            <Trans>Mixed</Trans>
          </Chip>
        </Row>
      </Section>

      <Section title={<Trans>Segmented control</Trans>}>
        <SegmentedControl
          aria-label={i18n._(msg`Explain it`)}
          defaultSelected="simply"
          options={[
            { id: "simply", label: <Trans>Simply</Trans> },
            { id: "depth", label: <Trans>In depth</Trans> },
            { id: "revision", label: <Trans>Revision</Trans> },
          ]}
        />
        <SegmentedControl
          aria-label={i18n._(msg`Explain it`)}
          defaultSelected="depth"
          isDisabled
          options={[
            { id: "simply", label: <Trans>Simply</Trans> },
            { id: "depth", label: <Trans>In depth</Trans> },
            { id: "revision", label: <Trans>Revision</Trans> },
          ]}
        />
      </Section>

      <Section title={<Trans>Text fields</Trans>}>
        <Input
          label={<Trans>Course name</Trans>}
          placeholder={i18n._(msg`For example, Biochemistry 201`)}
        />
        <Input
          label={<Trans>Course code</Trans>}
          description={<Trans>As it appears on your timetable.</Trans>}
          defaultValue="BIOC 201"
        />
        <Input
          label={<Trans>Exam date</Trans>}
          defaultValue="2026-01-03"
          isInvalid
          errorMessage={<Trans>Pick a date after today.</Trans>}
        />
        <Input label={<Trans>Instructor</Trans>} defaultValue="Dr. Haddad" isDisabled />
      </Section>
    </main>
  );
}

function Section({ title, children }: { title: ReactNode; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-4">
      <h2 className="text-title-3">{title}</h2>
      {children}
    </section>
  );
}

function Row({ children }: { children: ReactNode }) {
  return <div className="flex flex-wrap items-center gap-3">{children}</div>;
}

function CloseIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="size-6" fill="none">
      <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

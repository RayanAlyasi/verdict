import { msg } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/Button";
import { Chip } from "@/components/ui/Chip";
import { EmptyState } from "@/components/ui/EmptyState";
import { IconButton } from "@/components/ui/IconButton";
import { Input } from "@/components/ui/Input";
import { Light } from "@/components/ui/Light";
import { Panel } from "@/components/ui/Panel";
import { ProgressLights } from "@/components/ui/ProgressLights";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { Skeleton } from "@/components/ui/Skeleton";
import { Toasts } from "@/components/ui/Toast";
import { initLingui } from "@/lib/i18n";
import { alternates } from "@/lib/locales";
import { SheetDemo } from "./SheetDemo";
import { ToastDemo } from "./ToastDemo";

export async function generateMetadata(): Promise<Metadata> {
  const { locale } = await initLingui();
  return { robots: { index: false }, alternates: alternates(locale, "/dev/ui") };
}

// Every component in every state it can hold still, in both languages: this replaces a separate
// Storybook (spec 000). Hover, pressed and focus need a pointer or keyboard, and component tests
// cover them. Shown only in development, tests and staging; an unset APP_ENV hides it.
export default async function ComponentGallery() {
  await connection();
  if (!["development", "test", "staging"].includes(process.env.APP_ENV ?? "")) notFound();
  const { i18n } = await initLingui();
  const saving = i18n._(msg`Saving`);
  const close = i18n._(msg`Close`);
  const [question, questions] = [4, 10];

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
          <Button variant="ghost" isDisabled>
            <Trans>Skip this question</Trans>
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
          <IconButton label={close} isDisabled>
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

      <Section title={<Trans>Panels</Trans>}>
        <Panel>
          <p className="text-small font-semibold">
            <Trans>Next: enzyme kinetics</Trans>
          </p>
          <p className="text-note text-text-muted">
            <Trans>Today&apos;s session, about 25 minutes.</Trans>
          </p>
        </Panel>
        <Panel tone="glow">
          <p className="text-small">
            <Trans>9 of 12 midterm topics mastered.</Trans>
          </p>
        </Panel>
        <Panel tone="amber">
          <p className="text-small">
            <Trans>Common trap: converting the units after the formula.</Trans>
          </p>
        </Panel>
        <Panel tone="coral">
          <p className="text-small">
            <Trans>We couldn&apos;t read page 4 of this file. Try a clearer photo.</Trans>
          </p>
        </Panel>
      </Section>

      <Section title={<Trans>Lights</Trans>}>
        <Row>
          <span className="flex items-center gap-2 text-note">
            <Light status="mastered" />
            <Trans>Mastered</Trans>
          </span>
          <span className="flex items-center gap-2 text-note">
            <Light status="progress" />
            <Trans>In progress</Trans>
          </span>
          <span className="flex items-center gap-2 text-note">
            <Light status="not-started" />
            <Trans>Not started</Trans>
          </span>
          <span className="flex items-center gap-2 text-note">
            <Light status="current" />
            <Trans>Current question</Trans>
          </span>
        </Row>
        <ProgressLights
          label={i18n._(msg`Question ${question} of ${questions}`)}
          completed={3}
          total={10}
        />
      </Section>

      <Section title={<Trans>Loading</Trans>}>
        <Panel aria-busy="true">
          <span className="sr-only">
            <Trans>Loading your course</Trans>
          </span>
          <Skeleton className="h-5 w-2/3" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-5/6" />
        </Panel>
      </Section>

      <Section title={<Trans>Empty state</Trans>}>
        <Panel>
          <EmptyState
            headingLevel={3}
            icon={<BookIcon />}
            title={<Trans>No courses yet</Trans>}
            description={
              <Trans>
                Add a course and its files, and Verdict builds your study plan from them.
              </Trans>
            }
            action={
              <Button>
                <Trans>Add your first course</Trans>
              </Button>
            }
          />
        </Panel>
      </Section>

      <Section title={<Trans>Toasts and sheets</Trans>}>
        <ToastDemo
          samples={[
            {
              label: i18n._(msg`Show a confirmation`),
              toast: { title: i18n._(msg`Course saved.`), tone: "success" },
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

function BookIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="size-7" fill="none">
      <path
        d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15H6.5A2.5 2.5 0 0 0 4 20.5zM4 20.5A2.5 2.5 0 0 0 6.5 23H20"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="size-6" fill="none">
      <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

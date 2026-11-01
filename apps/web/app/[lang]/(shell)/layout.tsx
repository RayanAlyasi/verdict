import { msg } from "@lingui/core/macro";
import { connection } from "next/server";
import type { ReactNode } from "react";
import { AppShell } from "@/components/ui/AppShell";
import { sourceCodeUrl } from "@/lib/environment";
import { initLingui } from "@/lib/i18n";

export default async function ShellLayout({ children }: { children: ReactNode }) {
  const { i18n, locale } = await initLingui();
  // At request time: a deployment's source address isn't part of the build.
  await connection();
  return (
    <AppShell
      locale={locale}
      sourceCodeUrl={sourceCodeUrl()}
      labels={{
        skip: i18n._(msg`Skip to content`),
        main: i18n._(msg`Main`),
        today: i18n._(msg`Today`),
        course: i18n._(msg`Course`),
        practice: i18n._(msg`Practice`),
        progress: i18n._(msg`Progress`),
        ask: i18n._(msg`Ask Verdict`),
        yourCourses: i18n._(msg`Your courses`),
        addCourse: i18n._(msg`Add a course`),
        profile: i18n._(msg`Profile and settings`),
        sourceCode: i18n._(msg`Source code`),
      }}
    >
      {children}
    </AppShell>
  );
}

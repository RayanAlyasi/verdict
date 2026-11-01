import Image from "next/image";
import type { ReactNode } from "react";
import {
  AskIcon,
  CourseIcon,
  PlusIcon,
  PracticeIcon,
  ProfileIcon,
  ProgressIcon,
  TodayIcon,
} from "./icons";
import { NavLink } from "./NavLink";
import { PageTransition } from "./PageTransition";
import wordmark from "./verdict-wordmark.svg";

export type ShellLabels = {
  skip: string;
  main: string;
  today: string;
  course: string;
  practice: string;
  progress: string;
  ask: string;
  yourCourses: string;
  addCourse: string;
  profile: string;
  sourceCode: string;
};

const sideLink =
  "flex min-h-touch-target items-center gap-3 overflow-hidden rounded-md px-3 text-small text-text-faint aria-[current=page]:bg-space-800 aria-[current=page]:font-semibold aria-[current=page]:text-text";

// The bar on the open page's start edge, which mirrors in Arabic as a physical shadow wouldn't.
const sideBar =
  "after:absolute after:inset-y-0 after:start-0 after:w-0.75 after:bg-glow after:opacity-0 aria-[current=page]:after:opacity-100";

const sourceLink =
  "inline-flex min-h-touch-target items-center rounded-sm px-3 text-caption text-text-faint underline underline-offset-2 outline-offset-2 hover:text-text focus-visible:outline-2 focus-visible:outline-focus";

// Every signed-in page: a sidebar from 1024px and bottom navigation below it, with both in the
// HTML so the choice is made by CSS, not by JavaScript. Text arrives translated, as props.
export function AppShell({
  locale,
  labels,
  sourceCodeUrl,
  children,
}: {
  locale: string;
  labels: ShellLabels;
  // AGPL: anyone running Verdict offers its source, so this shows at every width.
  sourceCodeUrl: string;
  children: ReactNode;
}) {
  const sections = [
    { path: "", label: labels.today, Icon: TodayIcon },
    { path: "/course", label: labels.course, Icon: CourseIcon },
    { path: "/practice", label: labels.practice, Icon: PracticeIcon },
    { path: "/progress", label: labels.progress, Icon: ProgressIcon },
  ];
  return (
    <div data-app-shell className="lg:grid lg:grid-cols-[15rem_minmax(0,1fr)]">
      <a
        href="#content"
        className="fixed start-2 top-2 z-20 rounded-md bg-panel px-4 py-3 text-label text-text opacity-0 outline-offset-2 not-focus:pointer-events-none focus:opacity-100 focus-visible:outline-2 focus-visible:outline-focus"
      >
        {labels.skip}
      </a>

      <aside className="sticky top-0 hidden h-dvh flex-col gap-6 overflow-y-auto border-e border-divider bg-space-950/80 px-4 py-6 lg:flex">
        <Image src={wordmark} alt="Verdict" className="ms-1.5 h-6.5 w-auto self-start" />
        <NavLink
          locale={locale}
          path="/ask"
          className="flex min-h-touch-target items-center gap-3 rounded-control border border-panel-border-strong bg-panel px-3 text-small font-semibold text-text shadow-glow-soft"
        >
          <AskIcon className="size-5 text-glow" />
          {labels.ask}
        </NavLink>
        <nav aria-label={labels.yourCourses} className="flex flex-col gap-0.5">
          <span className="px-3 pb-1.5 text-caption text-text-faint">{labels.yourCourses}</span>
          <NavLink
            locale={locale}
            path="/add-course"
            className="flex min-h-touch-target items-center gap-3 rounded-md px-3 text-small font-semibold text-glow"
          >
            <PlusIcon className="size-4" />
            {labels.addCourse}
          </NavLink>
        </nav>
        <nav aria-label={labels.main} className="flex flex-col gap-0.5">
          {sections.map(({ path, label, Icon }) => (
            <NavLink key={path} locale={locale} path={path} className={`${sideLink} ${sideBar}`}>
              <Icon />
              {label}
            </NavLink>
          ))}
        </nav>
        <div className="mt-auto flex flex-col gap-1">
          <NavLink locale={locale} path="/profile" className={sideLink}>
            <ProfileIcon />
            {labels.profile}
          </NavLink>
          <a href={sourceCodeUrl} className={sourceLink}>
            {labels.sourceCode}
          </a>
        </div>
      </aside>

      <div className="flex min-h-dvh min-w-0 flex-col pb-(--bottom-nav-height)">
        <main id="content" tabIndex={-1} className="flex-1 outline-none">
          <PageTransition>{children}</PageTransition>
        </main>
        <div className="flex justify-center lg:hidden">
          <a href={sourceCodeUrl} className={sourceLink}>
            {labels.sourceCode}
          </a>
        </div>
      </div>

      <nav
        aria-label={labels.main}
        className="fixed inset-x-0 bottom-0 z-10 flex h-(--bottom-nav-height) border-t border-divider bg-space-900/90 px-[max(0.5rem,env(safe-area-inset-left),env(safe-area-inset-right))] pt-1 pb-[calc(0.625rem+env(safe-area-inset-bottom))] lg:hidden"
      >
        {sections.map(({ path, label, Icon }) => (
          <NavLink
            key={path}
            locale={locale}
            path={path}
            className="flex flex-1 flex-col items-center justify-center gap-0.5 rounded-md text-caption text-text-faint after:size-1.25 after:rounded-pill after:bg-glow after:opacity-0 aria-[current=page]:font-semibold aria-[current=page]:text-text aria-[current=page]:after:opacity-100"
          >
            <Icon className="size-6" />
            {label}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}

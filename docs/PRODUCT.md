# Product

**Verdict: know you're ready.** An exam coach built from a student's own course materials, for any major, on phone and desktop, in Arabic and English. No AI or prompting skills needed: students just say what they want.

## The problem
Students lean on rereading and highlighting, the least effective study methods, and guess what will be on the exam. Chat assistants answer in a vacuum: they don't know the professor, forget between sessions, grade kindly and never say when you're done. Unguarded AI help can even lower exam scores (Bastani et al. 2025, PNAS).

## Who it's for
| Persona | Situation | Job |
| --- | --- | --- |
| The planner | Starts weeks ahead | "Tell me what to study each day so I'm ready on time." |
| The crammer | Exam tomorrow | "Get me the most marks in the hours I have." |
| The med student | Huge volume, case and image questions | "Show me what's high-yield in my course and drill it." |
| The class rep | Organises the batch | "Set the course up once so everyone can start." |

## Product principles
1. Value in five minutes: one upload produces a course map and a first quiz.
2. One obvious next action per screen.
3. Defaults over settings; progressive disclosure for power features.
4. Never a blank wait: stream results, show progress.
5. Trust that's visible: every claim cites its source.
6. Help that teaches: hints, never answers, during practice.
7. Readiness is proven without AI help, on exam-like practice.
8. Practice feels like the real exam (format, timing, paper).
9. Bilingual, accessible and mobile-first from day one.
10. Ease is measured: five-student usability tests each milestone; target under 5 minutes to first answered question.

## Core concepts
- **Course:** each course is separate, with its own exams, plan, readiness, mistakes and calendar. Courses never compete for time.
- **Exam:** a course holds several exams (midterm, final, quizzes), each with a date, weight and scope. Verdict prepares for the next exam's scope and keeps earlier material fresh when the final is cumulative.
- **Course map:** topics and ideas extracted from the materials, each labelled Core / Likely / Extra with evidence, and each linked to its source slide or page.
- **The globe:** the course shown as a sphere of lights, one per idea. Green is mastered, amber in progress, dark not started. It forms during setup and lights up with study.

## Features
### Foundation
- Ingestion of slides (with speaker notes), PDFs, Word files, photos, textbook and past papers.
- Grounding: every claim, question and diagram cites its source; outside knowledge is labelled.
- Exam-relevance labels with evidence (syllabus, past papers, speaker notes, batch flags).
- Professor profile: focus, question style, recurring traps, textbook fidelity.

### Learn
- **Topic page:** one explanation page per topic with diagrams and visuals built in (analogy, interactive diagram, common mistake). An "Explain it" switch: Simply, In depth, Revision.
- **Make from a topic:** generated video lessons, flashcards, explain-it-back (voice) and games, listed under "Made from this topic".
- **Ask Verdict:** one box for questions and requests in plain words, typed or spoken (mic on every input, Arabic or English). Answers from course materials with sources; makes anything on request; hints only during practice.

### Practice
- Study loop: pretest, targeted explanation, explain-back, practice with fading help, step-based feedback.
- Hint ladder: nudge, then hint, then one worked step; never the answer first.
- One-tap confidence: answer buttons are "Not sure" and "I'm sure"; confident mistakes return sooner. Skipped in timed mocks; can be turned off.
- Practice exams in five types: **Prediction** (professor style mixed with textbook and slides, recommended), **Professor style** (needs past exams), **Textbook and slides**, **Trap questions**, **One topic**. Every exam can be solved on screen or printed as a PDF that looks like the real paper.
- Games, flashcards, Kahoot export, revision sheets.
- Focus timer (optional Pomodoro).

### Results and solutions
- Results after any quiz or exam: score, readiness change, filters (All, Wrong, Sure but wrong), a question grid.
- Every question: the text explanation marked step by step, sources, **Watch how to solve it** (short solution video) and **Try a similar one**.
- **Full worked solution page** for long or multi-step questions: givens, each step with why and the full calculation, comparison with the student's work, final answer, sanity check, common trap.
- **Watch the whole exam solved:** one walkthrough video of the full exam.

### Remember and prove readiness
- Spaced reviews (FSRS) planned backwards from each exam date; calendar feed.
- Mistake notebook with misconception and trap tags.
- Readiness per exam, computed only from unassisted work; "Explain the whole exam" video.
- Last Night mode and exam-morning kit (later).

### Together
- Share a course with a batch by invite link; shared, crowd-checked questions; anonymous batch stats.

## Research foundations (summary)
| Finding | Source | What Verdict does |
| --- | --- | --- |
| Practice testing and spacing are the most useful techniques | Dunlosky et al. 2013 | Quiz-first; spaced reviews |
| Optimal spacing depends on the test date | Cepeda et al. 2008 | Reviews aimed at the exam date |
| Self-explanation helps (g = 0.55) | Bisra et al. 2018 | Explain-it-back |
| Step-based tutoring nearly matches human tutors | VanLehn 2011 | Step-based marking |
| A pedagogically designed AI tutor beat active learning | Kestin et al. 2025 | Purpose-built, grounded tutor |
| Unguarded GPT-4 lowered exam scores 17% | Bastani et al. 2025 | Hints not answers; unassisted readiness |
| Matching to "learning styles" has no evidence | Pashler et al. 2008 | Formats as preferences only |
| Intrinsic game integration teaches more | Habgood and Ainsworth 2011 | Game moves are study moves |

## Hosting model
Feedback phase: fully hosted, including AI; students sign in with Google; per-student fair-use limits. Full release adds bring-your-own key, local models, an MCP connector and self-hosting.

## Roadmap
| Phase | Focus | Gate |
| --- | --- | --- |
| 0 | Foundation: repo, CI/CD, environments, design system in code | Staging deploys automatically; CI green |
| 1 | Sign-in, course setup, ingestion, course map, Today, study session | 98% citation accuracy on the evaluation set |
| 2 | Spaced reviews, mistakes, readiness, practice exams, results, solutions | Private beta with 2 to 3 batches |
| 3 | Topic page generation (videos, flashcards, games), Ask Verdict, PDF exams, sharing | Public release before spring 2027 finals |
| 4 | Full release: bring your own AI, self-hosting, voice room, Last Night mode | |

## Success metrics
Time to first answered question under 5 minutes; setup completion over 80%; System Usability Scale 80+; daily review completion over 60%; citation accuracy 98%+; flagged questions under 2%; over half of active students reach "ready" before their exam.

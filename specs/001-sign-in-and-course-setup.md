# 001. Sign-in and course setup

- Status: Ready
- Phase: 1
- Designs: `../verdict-internal/design/screens/phone-setup.png`, `../verdict-internal/design/screens/desktop-setup.png`
- Decisions: [ADR 0010](../docs/adr/0010-stack-revised.md) (Better Auth, Docling, DBOS)

## Before building
- Run Docling on 20 real course files (slides with speaker notes, textbook PDFs, past papers, Arabic PDFs, phone photos). Measure:
  - text accuracy, including reading order and speaker notes;
  - seconds per page on the worker VM.
- If Arabic text from a PDF's text layer comes out wrong, send those pages to the vision model instead. Record the results in this spec.
- **Open question:** the phone design shows "Next exam: midterm" with no way to change the type. Proposal: tapping "midterm" opens a sheet with midterm, final, quiz and other. Confirm before building.

## Problem and goal
A new student must get from the landing page to "my course is being built" in under two minutes, without reading instructions. When this ships, a student signs in with Google, names a course, adds one or more exams, uploads slides and past papers, and watches their course globe form as Verdict reads the files.

## User flow (phone first)
1. Landing page: one line of value ("Know you're ready.") and **Continue with Google**.
2. After sign-in, first-time students land on **Add your first course** (design: setup).
3. Course name; next exam (type: midterm, final, quiz, other; date); "Add another exam" adds rows (desktop shows rows inline).
4. Upload area: tap to choose or drag and drop (desktop). PDF, PowerPoint, Word, images. Each file shows a row with progress, then "Read, N slides with notes" and a green tick.
5. The small globe in the upload area gains points as pages are read (forming animation tied to real progress).
6. **Build my course** is enabled once there is a name, at least one exam and at least one file read. It leads to a "building your course" state (spec 002 continues from here).
7. Alternative: "Join your batch's course" link (placeholder until spec 013; shows "Coming soon" sheet).

## UI and states
- Empty, uploading (per-file progress), reading (per-file status), partially failed (one file failed with a plain reason and Retry), all done.
- Errors use plain words: "We couldn't read page 4 of this file. Try a clearer photo or upload the PDF."
- Exam date picker is native on phones; validation inline, never on submit only.
- Arabic: mirrored layout; dates formatted per locale.

## Data and API (modules: identity, courses, ingestion)
- **Tables:**
  - `users` (from the JWT on the first authenticated request);
  - `courses` (owner, name);
  - `exams` (course, kind, date, weight nullable, scope nullable);
  - `sources` (course, filename, type, size, status, failure reason, pages, storage key);
  - `source_pages` (course, source, number, text, speaker notes, page position data, read-by-vision flag).
- **Keys:** every table uses UUIDv7 keys, and course-scoped tables carry `course_id`.
- **Endpoints** under `/api/v1`, called directly by the browser:
  - `POST /courses`, `POST /courses/{id}/exams`, `DELETE /exams/{id}`;
  - `POST /courses/{id}/sources` (multipart; returns the source ID);
  - `GET /courses/{id}/sources/events` (SSE: per-source progress, fed by Postgres `LISTEN/NOTIFY`);
  - `GET /courses/{id}`.
- **DBOS workflow `ingest_source`:**
  1. Store the file.
  2. Convert it with Docling, one checkpointed step per batch of pages: text, reading order, speaker notes, tables, and page position for citations.
  3. Send pages with no usable text (photos, scans) to the vision model through the gateway's `extract` role, budget-checked.
  4. Publish progress events.
  A crash resumes at the next unfinished batch.
- **Sign-in:**
  - Better Auth with Google runs in the web app, with sessions in the `auth` schema.
  - The browser and the web server call the api with a short-lived Ed25519 JWT. The api verifies it against Better Auth's JWKS.
- **Seed data:** a seeded demo course and test accounts for development and staging.

## Security and privacy
- Every endpoint checks the course belongs to the user. Tests for cross-user access return 404.
- Upload limits: 50 MB per file, 500 MB per course, allowed types only (checked by content sniffing, not extension). Files stored privately; never served directly.
- Rate limit uploads per user.

## Acceptance criteria
- [ ] Google sign-in works in dev; a new user lands on Add your first course; a returning user lands on Today (placeholder).
- [ ] A course with two exams and three files (PDF, PPTX with speaker notes, PNG photo) is created; speaker notes are stored.
- [ ] Per-file progress and the forming globe update live via SSE; a failed file shows a plain reason and can be retried.
- [ ] Killing the ingestion worker mid-file resumes at the next unfinished batch of pages without re-reading finished ones (tested).
- [ ] An Arabic PDF is read with the correct text and reading order (fixture from the Docling check).
- [ ] Build my course is disabled until requirements are met, with the reason shown on tap.
- [ ] Another user cannot read or modify the course (tested).
- [ ] Works at 360px and 1440px, in Arabic, with keyboard only; axe clean.
- [ ] Time from landing to "building your course" under 2 minutes in a five-student test.

## Test plan
- **Unit tests for extraction,** with fixtures: a small PDF, a PPTX with notes, an Arabic PDF, an image.
- **API integration tests** for endpoints, authorization and JWT verification (expired, wrong key and tampered tokens are rejected).
- **Playwright journey 1** at both widths, with the fake AI provider.

## Out of scope
Course map building (002), joining a batch (013), editing exam scope (later).

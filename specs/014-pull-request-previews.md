# 014. Pull request previews

- Status: Ready
- Phase: 0 · Issue: #33
- Designs: none (a pull request comment and the app as it is)

## Problem and goal
The maintainer reviews pull requests from screenshots and staging, and staging shows a change only after it's merged. This lets them see a pull request running before they merge it, on a link like Vercel's preview links: add a `preview` label, and a bot comments with a link to that pull request's build, which updates on every push and goes away when the pull request closes.

## User flow
1. The maintainer opens a pull request from a branch in this repository and adds the `preview` label.
2. The images build from the pull request's commit (a few minutes), then the bot comments that the preview is deploying.
3. About two minutes later the comment shows the link (`https://verdict-preview-1.alyasi.tech` or `-2`) and the commit it shows. The link opens behind the same Cloudflare Access login as staging.
4. Each push from the maintainer to that branch updates the preview and the comment. Its data stays.
5. Removing the label, closing the pull request, or merging it removes the preview and its data, frees its slot, and the comment says so.
6. If both slots are in use, the comment names the pull requests holding them and asks the maintainer to free one; relabelling then deploys.

## UI and states
One bot comment per pull request, edited in place, never a new comment per push:
- **Deploying:** "Deploying a preview of `abc1234`…", once the images are built.
- **Ready:** "Preview of `abc1234`: https://verdict-preview-1.alyasi.tech". It reports the version the preview's `/api/health` returns, so a stale link can't pass for a fresh one.
- **Waiting:** "Both preview slots are in use (#12, #14). Remove the `preview` label from one or close it, then add the label here again."
- **Failed:** "The preview of `abc1234` didn't build" (for an update, with a note that the earlier version still runs and its link), or "didn't fully deploy", with a link to the run and the preview. The parts boot one at a time, so it says how far the deploy got: nothing changed, only some parts are on the new version, or everything is but the final check failed.
- **Not deployed:** a commit someone other than the owner pushed: "`abc1234` wasn't deployed because someone other than the repository owner pushed it. Push again, or re-run its preview-request run, to deploy it."
- **Removed:** "Preview removed" and why (label removed, closed or merged).

Copy follows `verdict-voice` for tone, though only the maintainer reads it.

## Data and API
- **No app or API changes.** Previews run the same images CI builds for staging and production, from the pull request's code.
- **Per slot:** the api, one worker per queue and the web app, plus a Postgres database of its own (`verdict-preview-N-db`) and storage on a Docker volume. The database is created empty when a pull request takes the slot, kept across its pushes (migrations run as usual), and deleted when the preview is removed.
- **Slots:** two fixed hostnames, `verdict-preview-1.alyasi.tech` and `verdict-preview-2.alyasi.tech`, each a Kamal destination. Their DNS records, tunnel routes and Access gate are set up once, so CI never holds Cloudflare credentials. They're served through staging's tunnel.
- **Which pull request holds a slot** is recorded on the server, in a file per slot that holds the pull request's number. A run creates it only if it doesn't exist, so two runs can't take the same slot; removing the preview deletes it.
- **AI:** previews use staging's Anthropic key, with a daily cap of 0.125 US dollars each, so both together spend at most 0.25 a day.

## AI behaviour (if any)
None changes. AI features behave as in staging, within the preview cap.

## Security and privacy
- **Only the maintainer's code runs.** A preview deploys only a commit the repository owner pushed, according to the repository's activity log, on a branch in this repository. Adding the label doesn't vouch for a commit someone else pushed. Pull requests from forks, and pushes by anyone else (including CodeRabbit's commits), never deploy; the owner's next push, or the owner re-running its preview-request run, does. Anyone who can add labels can take a slot for one of the owner's pull requests, but only the owner's commits run.
- **The pull request can't change how it's deployed.** A workflow the pull request can edit only reports that something changed. A separate workflow from `main` (`workflow_run`) checks the pull request through the API (who pushed the commit, the label, a branch in this repository, still open). It then builds the images itself from that commit, in a job with no secrets or server access, and deploys them. Nothing the pull request's own workflow produces is used.
- **Previews never see staging's or production's data.** Each has its own database and passwords. They share Docker's `kamal` network with staging and production, as staging does with production; separate passwords keep them apart.
- **Previews are behind Cloudflare Access** (the maintainer's `Owner` policy), like staging.
- **Previews hold no real student data:** sign-in, when it arrives, uses the staging Google client.

## Acceptance criteria
- [ ] Labelling a pull request from a branch in this repository deploys it to a free slot, and the comment links to it within 10 minutes. `/api/health` there reports the pull request's commit.
- [ ] A push from the owner updates the preview and the comment, and data entered in the preview survives it.
- [ ] Removing the label, closing or merging removes the preview's containers, database and volume, and frees the slot. A sweep every 6 hours removes any preview whose pull request isn't open with the label, for events GitHub didn't deliver. GitHub sends no pull request events while a pull request has a merge conflict, so until it's resolved, pushes don't update the preview either.
- [ ] With both slots in use, labelling a third pull request deploys nothing and the comment names the pull requests holding the slots.
- [ ] A pull request from a fork, or a commit pushed by someone other than the owner, never reaches the server (proved once with a test branch pushed by another account or app).
- [ ] The deploying workflow runs from `main` only; changing the preview workflows in a pull request doesn't change how that pull request is deployed.
- [ ] A failed build changes nothing on the server, and for an update the comment keeps the earlier preview's link. A failed deploy says in the comment how far it got (nothing changed, some parts updated, or all updated with the final check failing), and keeps the preview's link.
- [ ] zizmor reports no findings for the new workflows.

## Test plan
- A throwaway pull request through every state: building, ready, updated, waiting (with two other labelled pull requests), failed (a commit that breaks the build), removed by unlabelling, by closing and by merging.
- The fork and other-author cases, proved once.
- `kamal config` for both preview destinations in the existing `kamal` CI job.

## Out of scope
- Previews for pull requests from forks.
- More than two slots, or a link that stays the same per pull request.
- Seeded demo data (the preview starts empty until a later spec adds a seed).
- Previews of api-only changes without the web app.

<!-- Preview flow test B; closed, never merged. -->

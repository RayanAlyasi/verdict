---
name: verdict-design-system
description: Defines Verdict's visual system (the Globe direction) with tokens, components, interaction states, motion and the approved screen designs. Use when building, changing or reviewing any UI in apps/web.
---

# Verdict design system

Build every screen to match the approved designs, using tokens from `docs/brand/tokens.json` and the rules in `docs/UX-GUIDELINES.md`. The product UI is dark-first.

## Approved designs
Open these images with Read before building or reviewing a screen. They live in the maintainers' private design repository, cloned next to this one; if `../verdict-internal/` is missing, work from the spec, `docs/UX-GUIDELINES.md` and the tokens. Sources with exact markup and keyframes: `../verdict-internal/design/source/<same-name>.dc.html`.
| Screen | Phone | Desktop |
| --- | --- | --- |
| Setup | `../verdict-internal/design/screens/phone-setup.png` | `../verdict-internal/design/screens/desktop-setup.png` |
| Today | `../verdict-internal/design/screens/phone-today.png` | `../verdict-internal/design/screens/desktop-today.png` |
| Study session | `../verdict-internal/design/screens/phone-study-session.png` | `../verdict-internal/design/screens/desktop-study-session.png` |
| Practice | `../verdict-internal/design/screens/phone-practice.png` | `../verdict-internal/design/screens/desktop-practice.png` |
| Topic page | `../verdict-internal/design/screens/phone-topic.png` | `../verdict-internal/design/screens/desktop-topic.png` |
| Exam results | `../verdict-internal/design/screens/phone-results.png` | `../verdict-internal/design/screens/desktop-results.png` |
| Full worked solution | `../verdict-internal/design/screens/phone-full-solution.png` | `../verdict-internal/design/screens/desktop-full-solution.png` |

## Core tokens (dark)
`space-900 #0A1222` background · `panel #101B2E` cards · `panel-border #22345A` · `input #0C1626` · `text #FFFFFF` · `text-muted #C9D3DF` · `text-faint #8C9AAE` · `glow #3CC4A2` primary, mastered, links · `amber #E3A84A` in progress, traps · `coral #F07A6E` wrong, errors · `dim #33465F` not started · `control-border #587098` borders of inputs, secondary buttons and chips (3:1 on `panel`, `input` and the page background, lighter than the designs' border so it meets WCAG 1.4.11) · `divider #1C2C47` · `glow-border`, `amber-border`, `coral-border` around tinted surfaces. Motion: `fast 120ms`, `base 200ms`, `slow 320ms`, easing `cubic-bezier(0.2,0,0,1)`. Radius: `badge 8px`, `md 10px`, `control 12px` (inputs), `row 14px` (list rows, answer options), `lg 16px`, `card 18px` (panels), `xl 22px`, `pill`. Text: the `display` to `caption` scale, plus `label` 14px (chips, compact buttons), `note` 14px (secondary text) and `meta` 12px (only for text nobody acts on: 13px is the floor for anything a student acts on).

### Tokens in code
Tailwind's theme is generated from `tokens.json` (`apps/web/app/theme.css`; edit the tokens, then `pnpm --dir apps/web tokens`), and only brand values exist: Tailwind's stock colours, radii, text sizes, shadows, easings and breakpoints are removed.
- **Spacing:** numeric classes on a 4px base. The brand scale `space-1` to `space-8` is `1 2 3 4 6 8 12 16` (`p-6` is `space-5`, 24px); stay on those steps.
- **Motion:** `duration-press`, `duration-fast`, `duration-base`, `duration-slow`, `ease-standard`. A bare `transition-*` already uses `base` and `ease-standard`.
- **Other names:** colours as in the token names (`bg-panel`, `text-text-muted`, `border-panel-border`), `rounded-md`, `text-caption`, `shadow-glow-primary`, `bg-nebula`, `min-h-touch-target`.
- **Focus:** `outline-2 outline-offset-2 outline-focus`. Avoid `ring-offset-*`, which paints a white band on the dark background.
- **Arabic line heights:** headings, `caption` and `meta` get taller line heights on Arabic pages (`:lang(ar)` overrides generated from `lineHeightArabic`), because Arabic marks above and below the line would touch the next line.
- **Font:** `font-sans` is Readex Pro, self-hosted by `next/font` in `app/[lang]/layout.tsx`. Its Latin and Arabic files are preloaded; other scripts' files load only for text that needs them. While it loads, the fallback is sized to Latin letters only, so Arabic text can reflow when it arrives.
- **Direction:** logical classes only (`ms-*`, `pe-*`, `start-*`, `text-start`, `rounded-s-*`), so Arabic mirrors. The e2e suite fails when a rule sets one side differently from the other (`ml-*`, `left-*`, `rounded-l-*`, `text-right`). It can't judge transforms (`translate-x-*`), positions (`origin-left`, `bg-left`) or directional icons: give those an `rtl:` variant and check the Arabic screenshots.

## Signature elements
- **Globe:** a Fibonacci sphere of points drawn on one `<canvas>`, with the glow from an image prepared once. Point colour shows mastery, and an optional orbit ring carries a satellite for the next session. Always paired with a plain-language line and the light legend in HTML.
- **Lights:** small glowing dots for mastered, in progress and not started; always next to a word.
- **Space background:** drifting nebula, two twinkling star layers, a rare shooting star; behind content only.
- **Primary action:** one per screen; pill, `glow` fill, dark text, soft pulsing glow.
- **Verdict sentence:** ends with a coloured full stop ("Almost ready." in amber, "Ready." in glow).

## Components
Build once in `apps/web/components/ui`, on React Aria Components styled with Tailwind: Button (primary, secondary, ghost), IconButton, Input, Textarea with mic, Select, Panel, Chip, SegmentedControl, Light, ProgressLights, Globe, AnswerOption (A to D letter box), SourceChip, Toast, Sheet (phone) and Dialog (desktop), BottomNav, Sidebar, AppShell, PageTransition, Skeleton, EmptyState.

Built so far: Button (`variant`, `size`, `pulse` for the screen's main action, `isPending` with `pendingLabel`), IconButton, Input, Chip and SegmentedControl. `/en/dev/ui` and `/ar/dev/ui` show them in every state outside production. They take their text as props or children, already translated by the page, so they never import Lingui; `components/ui/styles.ts` holds the shared state classes.

Every interactive component has these states:
- **Hover:** style it from React Aria's `data-hovered`, which never fires on touch.
- **Pressed:** `data-pressed`, with `scale(0.97)` in 80ms.
- **Focus:** `data-focus-visible`, with a 2px ring at a 2px offset.
- **Disabled.**
- **Loading:** keeps its size.

Every interactive component also has a 44px minimum target and uses logical CSS properties for Arabic.

## Gotchas
- Put the space background at `z-index: -1` inside an `isolation: isolate` container; otherwise it covers content.
- Never animate width, height, top, margin, `box-shadow` or `filter`; animate transform and opacity.
- The design sources pulse glows with `box-shadow` (`@keyframes tw`, `glowp`). Don't copy them: they repaint every frame. Draw the glow once, then animate its opacity.
- Render soft gradients (the nebula) at a quarter of their size and scale them up; they look the same and use far less GPU memory.
- Superscripts and fractions break inside flex rows; render equations as inline text lines.
- Pause globe spin and starfield when the tab is hidden or the element is off screen; render them static under `prefers-reduced-motion`.
- Keep inputs at 16px or larger, or iOS zooms the page.

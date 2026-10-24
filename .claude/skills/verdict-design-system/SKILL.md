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
`space-900 #0A1222` background · `panel #101B2E` cards · `panel-border #22345A` · `input #0C1626` · `text #FFFFFF` · `text-muted #C9D3DF` · `text-faint #8C9AAE` · `glow #3CC4A2` primary, mastered, links · `amber #E3A84A` in progress, traps · `coral #F07A6E` wrong, errors · `dim #33465F` not started. Motion: `fast 120ms`, `base 200ms`, `slow 320ms`, easing `cubic-bezier(0.2,0,0,1)`. Radius: `md 10px`, `lg 16px`, `xl 22px`, `pill`.

## Signature elements
- **Globe:** a Fibonacci sphere of points drawn on one `<canvas>`, with the glow from an image prepared once. Point colour shows mastery, and an optional orbit ring carries a satellite for the next session. Always paired with a plain-language line and the light legend in HTML.
- **Lights:** small glowing dots for mastered, in progress and not started; always next to a word.
- **Space background:** drifting nebula, two twinkling star layers, a rare shooting star; behind content only.
- **Primary action:** one per screen; pill, `glow` fill, dark text, soft pulsing glow.
- **Verdict sentence:** ends with a coloured full stop ("Almost ready." in amber, "Ready." in glow).

## Components
Build once in `apps/web/components/ui`, on React Aria Components styled with Tailwind: Button (primary, secondary, ghost), IconButton, Input, Textarea with mic, Select, Panel, Chip, SegmentedControl, Light, ProgressLights, Globe, AnswerOption (A to D letter box), SourceChip, Toast, Sheet (phone) and Dialog (desktop), BottomNav, Sidebar, AppShell, PageTransition, Skeleton, EmptyState.

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

# UX guidelines

Ease of use is Verdict's main differentiator. A first-year student in any major, on a mid-range phone, must succeed without help. These rules apply to every screen; the approved designs are kept in the maintainers' private design repository.

## Core rules
1. **One obvious next action** per screen, in thumb reach on phones (bottom 40% of the screen).
2. **Plain words.** Labels say what happens ("Start today's session"). Copy follows the `verdict-voice` skill.
3. **Show less, reveal more.** Power features appear when relevant.
4. **Never a blank wait.** Skeletons within 100 ms, streamed AI text, honest progress.
5. **Explain the visuals.** Any chart, globe or number has a plain-language label ("You've mastered 64% of what's on your midterm").

## Responsive layout (mobile-first)
| Width | Layout |
| --- | --- |
| under 640px (phones) | Single column, bottom navigation with 4 tabs, sticky primary action above the nav |
| 640 to 1023px (tablets) | Single column with wider margins; bottom navigation |
| 1024px and up (laptops) | Left sidebar (courses, Ask Verdict, sections), content up to 1120px, side panels where designed |
- Build every component at 360px first, then enhance. Test at 360, 390, 768, 1024 and 1440px.
- Use `dvh` units and safe-area insets on phones; primary actions stay visible above the on-screen keyboard.
- Inputs use 16px text or larger so iOS does not zoom.

## Interaction states (required on every interactive element)
| State | Treatment |
| --- | --- |
| Hover | Pointer devices only (React Aria's `data-hovered`, which a finger never sets): subtle lift or glow, border brightens, 120 ms |
| Pressed | Scale to 0.97 with 80 ms ease-out; release springs back |
| Focus-visible | 2px focus ring (`focus` token) with 2px offset; never removed |
| Disabled | 40% opacity, no hover. Natively disabled, so Tab skips it and a tap does nothing: when the reason isn't obvious, say it in visible text next to the control |
| Loading | Keeps its size; spinner or progress replaces the label; double submits blocked |
| Selected | Green border and soft glow (answer options, chips, tabs) |

## Motion system

| Class (token) | Duration | Use |
| --- | --- | --- |
| `duration-press` (`motion.press`) | 80 ms | Press feedback |
| `duration-fast` (`motion.fast`) | 120 ms | Hover, toggles |
| `duration-base` (`motion.base`) | 200 ms | State changes, expanding cards, tab switches; the default for any transition |
| `duration-slow` (`motion.slow`) | 320 ms | Page transitions, sheets, dialogs |
| Ambient (set per animation, not a token) | 6 to 30 s | Globe spin, starfield, nebula drift |

Easing: `ease-standard` (`cubic-bezier(0.2, 0, 0, 1)`), the default for any transition; spring-like CSS `linear()` easing for drag and press release. No animation library.
- **Page transitions:** the View Transitions API: fade plus 8px slide in the navigation direction; shared elements (the globe, a course card) morph between screens where designed. Browsers without support change pages instantly.
- **Lists:** stagger entrance by 30 ms, at most 8 items.
- **Feedback moments:** a topic's light turning green, a correct answer glowing, readiness numbers counting up.
- Animate only `transform` and `opacity`. The separate `translate`, `scale` and `rotate` properties, which Tailwind's classes use, are transforms too. Never animate layout properties, `box-shadow` or `filter`: draw a glow once and animate its opacity.
- **Reduced motion:** with `prefers-reduced-motion`, ambient motion stops, transitions become instant fades, and the globe is shown static.

## The Globe direction (visual language)
Dark space background with a slowly drifting nebula, twinkling stars and the occasional shooting star; glowing green accents; the course as a 3D globe of lights. Details and tokens: `docs/brand/BRAND.md` and the `verdict-design-system` skill.
- The background never competes with text: content sits on solid panels; text contrast meets WCAG AA.
- Pause ambient animation when the tab is hidden or the element is off screen; reduce globe points on low-end devices.
- The globe is drawn on one `<canvas>`, not as hundreds of page elements; the plain-language line and legend stay in HTML.

## Performance budgets (mid-range phone, 4G)
Largest Contentful Paint under 2.5 s · Interaction to Next Paint under 200 ms · Cumulative Layout Shift under 0.1 · JavaScript per route under 200 KB compressed (React and Next.js alone take about 118 KB) · 60 fps during animations.

## Accessibility
WCAG 2.2 AA: contrast 4.5:1 for text, 3:1 for controls; full keyboard use; visible focus; screen-reader labels for icons and charts; touch targets at least 44 x 44px; colour is never the only signal (readiness uses colour, shape and words).

## Arabic and right-to-left
Use logical CSS properties (`margin-inline-start`, not `margin-left`). Layouts mirror; icons with direction (arrows, chevrons) flip; numbers and code stay left-to-right. Arabic text gets taller line heights than Latin for headings, captions and metadata, so the marks above and below a line don't touch the next. Every screen is checked in Arabic before merge.

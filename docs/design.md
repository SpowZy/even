# even — design system

## Color tokens

| token | hex | role |
| --- | --- | --- |
| `bg` | `#0a0a0f` | page background |
| `surface` | `#121218` | cards, rails |
| `elevated` | `#17171f` | hover/active surfaces, table head |
| `border` | `#1f1f28` | hairlines only, never decorative borders |
| `primary` | `#4f46e5` | the one accent: primary actions, ALLOW |
| `primary-soft` | `#6366f1` | hover states, chain highlights, live dot |
| `success` | `#10b981` | chain verified |
| `warn` | `#f59e0b` | REVIEW verdicts, redaction flags |
| `danger` | `#ef4444` | BLOCK verdicts, broken chain, tamper |
| `text` | `#e7e7ea` | primary text |
| `muted` | `#8b8b96` | secondary text |

One accent at a time. If violet and red compete in the same viewport, red
wins — it means something is broken.

## Typography

- **General Sans** (Fontshare) for display and text. Weights 400/500/600/700.
- **JetBrains Mono** for hashes, receipts, figures, code.
- Scale: 12 / 14 / 16 / 20 / 28 / 40 / 64 / 96.
- Tracking `-0.03em` at 28px and above; mono stays at 0.
- Display line-height 1.02–1.1; body 1.6.

## Motion

- Durations: 200 ms (micro), 400 ms (reveals), 600 ms (hero).
- Easing: `[0.22, 1, 0.36, 1]` (easeOutExpo family).
- Animate `transform` and `opacity` only. No layout thrash, ever.
- Marquee: 36 s linear loop, pauses on hover.
- **Always** honor `prefers-reduced-motion`: canvas renders one static
  frame, marquee and typing freeze fully rendered, Lenis stays off.

## Iconography

Hand-drawn SVG, 24×24 grid, `stroke: currentColor`, stroke-width 1.5, round
caps and joins, `fill: none`. No icon libraries. The set lives in
`apps/web/public/icons/`.

## The mark

Two equal vertical bars — the balance. Books that reconcile; a chain whose
two sides must match. Same violet, same height, symmetric. It must stay
legible at 16 px: no gradients, no detail below 2 px.

## Accessibility floor

- AA contrast minimum on all text (`text` on `bg` is AAA; `muted` on `bg`
  passes AA at 14px+).
- Every interactive element keyboard-focusable with a visible
  `outline-primary` focus ring.
- Landmarks: `header`, `main`, `section`, `footer`. Icon-only buttons carry
  `aria-label`.

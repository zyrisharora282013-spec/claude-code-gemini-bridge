# Dashboard Design System

Tokens live in `src/proxy/public/css/src/input.css` (CSS variables) and are exposed to Tailwind in `src/proxy/tailwind.config.js`. Rebuild with `npm run build:css` in `src/proxy`.

## Principles
1. Dark first, violet for action, cyan for information.
2. Dense but calm: monospace for data, Inter for prose.
3. Motion explains change; it never decorates for longer than 400ms and is disabled under `prefers-reduced-motion`.
4. Every interactive element has a visible focus ring.

## Color
| Token | Dark | Light | Use |
|---|---|---|---|
| `--sp-950` (`bg-space-950`) | `#09090b` | `#fafafc` | App background |
| `--sp-900` | `#0f0f11` | `#ffffff` | Panels, sidebar |
| `--sp-850` / `--sp-800` | `#121214` / `#18181b` | `#f4f4f7` / `#ebebf0` | Raised surfaces, inputs |
| `--sp-border` | `#27272a` | `#d6d6de` | Hairlines |
| `--accent-violet` | `#a855f7` | `#7e22ce` | Primary actions, active nav |
| `--accent-cyan` | `#22d3ee` | `#0e7490` | Info, focus ring, links |
| `neon-green / yellow / red` | `#22c55e / #eab308 / #ef4444` | same | OK / warning / error status |

Text: primary `#fff`, secondary `#d4d4d8`, tertiary `#a1a1aa` (all >= 4.5:1 on `#09090b`). Light mode primary `#0b0b10`, tertiary `#52525e` (>= 4.5:1 on white).

Enable light mode with `<html data-mode="light">`.

## Typography
Inter (sans) and JetBrains Mono (data). Scale: 10 / 12 / 14 / 16 / 18 / 20 / 24 / 30 px (`--text-2xs` to `--text-3xl`). Titles are bold with tight tracking; labels are mono, uppercase, 10-12px.

## Spacing & Radius
4px base: 4, 8, 12, 16, 24, 32, 48. Radius: 6 (controls), 8, 12 (cards), 16 (modals).

## Elevation
`--shadow-sm/md/lg` for depth, `--shadow-glow` for the primary accent. Glass surfaces use `--glass-bg` + 12px backdrop blur + `--glass-border`.

## Motion
Easing `--ease-out`; durations 120 / 200 / 400 ms. Page transitions are a 200ms fade/rise, stat count-up 600ms. Under `prefers-reduced-motion` all animation and transition durations collapse to ~0 and JS animations skip straight to the final value.

## Components
Sticky glass sidebar, command palette (Ctrl+K), skeleton loaders (`.skeleton*`), empty states (`.empty-state`), cards (`.view-card`), pills (`.status-pill-*`).

## Accessibility
Focus ring on `:focus-visible`, AA contrast for text, reduced-motion support, keyboard-navigable palette and sidebar, `aria-live` toasts.

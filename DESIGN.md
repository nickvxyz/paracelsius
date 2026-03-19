# Design System — Paracelsus

## Product Context
- **What:** AI spirit of Paracelsus — 30-day longevity behavioral intervention
- **Who:** Health-conscious adults curious about longevity
- **Aesthetic:** Dark occult meets clinical precision. Spirit summoning, not chatbot.
- **Type:** Conversational AI product with strong visual identity

## Aesthetic Direction
- **Direction:** Retro-Futuristic / Occult-Clinical hybrid
- **Decoration:** Intentional — CRT effects, alchemical symbols, summoning circle
- **Mood:** Unsettling, confrontational, oddly caring. A spirit that tells you the truth.

## Color System

### The Rule: Green = Spirit Speaks. Orange = Human Acts.

| Token | Hex | Usage |
|-------|-----|-------|
| `--background` | `#0a0a0a` | Page background (the void) |
| `--surface` | `#141414` | Cards, input backgrounds |
| `--surface-light` | `#1a1a1a` | Input fields, elevated surfaces |
| `--foreground` | `#ededed` | Body text |
| `--muted` | `#888888` | Secondary text, metadata |
| `--accent` | `#ff6b1a` | Buttons, CTAs, headings — the HUMAN color |
| `--accent-dim` | `#ff6b1a33` | Accent at low opacity |
| Spirit green | `rgba(140,230,180)` | Agent responses, summoning circle, errors, status |
| Spirit green glow | `rgba(120,200,160)` | Text-shadow, drop-shadow on spirit elements |

### Usage Rules
- Agent text: green phosphor with `text-shadow: 0 0 8px rgba(140,230,180,0.3)`
- User text: foreground color on `--surface` background
- Error messages: green phosphor, in-character ("The connection grows weak")
- CTAs / buttons: `--accent` orange
- Never use red for errors. The spirit doesn't speak in red.

## Typography

### Fonts
- **Orbitron** — Headings, buttons, CTAs, nav logo. Bold (700-900), uppercase, geometric.
- **Space Mono** — Body text, nav links, spirit text (EtherText), footer, metadata, chat input. Monospace substrate.

### Rules
- Buttons/CTAs: Orbitron 700, uppercase, 12-14px, sharp corners (0px border-radius)
- Headings: Orbitron 700-900, 24-56px depending on hierarchy
- Body: Space Mono 400, 14-15px
- Spirit text: Space Mono 400, 14px, green phosphor color + glow
- Nav links: Space Mono 400, 12px
- Muted/metadata: Space Mono 400, 12-13px

### Scale
- Hero: 36-56px Orbitron 900
- Page title: 24-32px Orbitron 700
- Section header: 12-13px Orbitron 500, uppercase, tracking-widest
- Body: 14-15px Space Mono 400
- Small: 12-13px Space Mono 400
- Loading: Google Fonts via next/font

### Sharp Corners
- Buttons: border-radius 0px — matches Orbitron's geometric personality
- Cards/inputs: border-radius 0px — consistent with buttons
- No rounded corners anywhere — the aesthetic is angular, precise, clinical

## CRT Portrait — Brand Anchor
The CRT portrait with summoning circle is the product's visual identity.
- **Must appear on ALL pages** (home, about, profile, auth)
- **Canvas-based** with glitch effects: RGB split, pixelation, noise, scanlines
- **Summoning circle:** SVG with alchemical symbols, rotating, green phosphor glow
- **`disturb()` API:** Called when agent speaks — portrait reacts to its own words
- **Responsive sizing:**
  - Mobile ≤430px: ~280px wide
  - Tablet 431-768px: ~360px wide
  - Desktop 769px+: 520px (full size)

## Spirit Chat Interface
- **No chat box.** Agent responses use EtherText scramble effect (alchemical symbols → final text)
- **User input:** Single line at bottom, sticky on mobile, `--surface-light` bg
- **Message counter:** "X messages remaining" in `--muted`, below input
- **Typing indicator:** 3 orange dots (existing pattern)
- **Conversation scrolls** below the portrait

## Interaction States
- **Loading:** Typing dots (3 orange dots) or green phosphor "..."
- **Empty:** EtherText intro auto-plays on landing
- **Error:** Green phosphor, in-character ("The connection between centuries grows weak")
- **Success:** EtherText response with scramble reveal
- **Partial:** Stream renders mid-word during SSE

## Paywall
- **Narrative, not modal.** Paracelsus speaks in-character through EtherText
- **Subscribe button:** Orange accent, inline below the narrative text
- **After payment:** Chat continues. Assessment completes naturally. Shock moment triggers on result.

## Shock Moment (Lifespan Reveal)
- CRT portrait glitches violently (sustained disturb)
- Summoning circle flares bright
- LifespanBar appears with number
- Triggered automatically when agent outputs `assessment_result` JSON

## Google OAuth
- Dark-themed button matching the aesthetic
- `--surface` background, `--muted` border
- Label: "Enter with Google" (not "Sign in with Google")
- Google "G" icon kept for trust

## Spacing
- **Base:** Tailwind defaults (4px base)
- **Density:** Comfortable — generous vertical spacing between elements
- **Max content width:** 640px for chat, 768px for profile

## Motion
- **EtherText:** Character scramble at configurable speed (charSpeed, lineDelay props)
- **CRT glitch:** 4-phase cycle (PRESENT → DECAY → HEAVY → RECOVER)
- **Summoning circle:** Slow rotation (~0.5 RPM), jitter on interference
- **LifespanBar:** Animated fill with easing
- **Ember particles:** Floating upward, infinite loop

## Accessibility
- `aria-live="polite"` on EtherText — screen readers get final text, not scramble
- Canvas portrait: `role="img"` `aria-label="Portrait of Paracelsus"`
- All touch targets: min 44px
- Green on black contrast ratio: ~10:1 (AAA)
- Keyboard: Enter to send, Tab to navigate

## Responsive
- **Mobile-first.** Design for 375px, scale up.
- Portrait + circle scale responsively (280px → 360px → 520px)
- Input sticky at bottom on mobile
- Nav: logo left, single action right on mobile

## Decisions Log
| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-03-18 | Green = spirit, Orange = human | Color split builds subconscious trust. Spirit has its own visual language. |
| 2026-03-18 | Errors in green, in-character | Spirit tells you about connection issues. No red. Maintains immersion. |
| 2026-03-18 | Portrait on ALL pages | Brand anchor. The spirit is always present. |
| 2026-03-18 | No chat box | Spirit-style EtherText responses. Not a widget. |
| 2026-03-18 | Narrative paywall | Spirit demands payment in-character. No generic modal. |
| 2026-03-18 | Post-payment: chat continues | Assessment isn't done at msg 10. User continues, shock on completion. |
| 2026-03-18 | Mobile-first, portrait scales | 280px mobile, 520px desktop. Always visible with circle. |
| 2026-03-18 | aria-live on EtherText | Screen readers get clean text, not scramble characters. |
| 2026-03-18 | Typography: Orbitron for buttons + sharp corners | Matches burnfat.fun style. Orbitron = actions (headings + buttons). Space Mono = substrate (body + spirit). 0px border-radius everywhere. |

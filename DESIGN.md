# DESIGN.md

## Mood
Mid-morning writing desk — crisp white paper, crimson ink stamp, quiet precision. Premium product calm (Linear × Apple Notes), not decorative.

## Color strategy
Restrained. Pure white content surface; cooler panel for sidebar; crimson primary ≤10% for actions and selection.

## Palette (OKLCH)
- bg: oklch(1 0 0)
- surface: oklch(0.985 0.003 28)
- panel: oklch(0.978 0.004 250)
- ink: oklch(0.18 0.018 28)
- muted: oklch(0.45 0.016 28)
- faint: oklch(0.62 0.012 28)
- primary: oklch(0.47 0.185 28)
- accent (SQL): oklch(0.46 0.11 230)

## Typography
Geist Sans (UI) + Geist Mono (SQL). Tracking tight on titles (−0.02em / −0.03em). Product scale, not display.

## Elevation
shadow-sm for controls; shadow / shadow-lg for auth and key CTAs. Hairline borders over heavy cards.

## Layout
Mobile: glass header/nav + full-screen editor. Desktop: cooler sidebar + list + editor. Safe-area insets for iPhone.

## Motion
150–240ms ease-out for state and list reveal. Reduced-motion: instant.

---
name: PenguCrush — Beyond the Horizon
description: Illustrated expedition game with ink contours, matte colour and short hard shadows.
colors:
  ink: "#172d3e"
  paper: "#fff2cf"
  gold: "#f6c44e"
  teal: "#50afa6"
  red: "#ef6047"
  inactive-nav: "#46666a"
  shop-paper: "#fff9e8"
typography:
  display:
    fontFamily: "Lilita One, sans-serif"
    fontWeight: 400
  body:
    fontFamily: "Rubik, sans-serif"
    fontWeight: 500
  label:
    fontFamily: "Rubik, sans-serif"
    fontWeight: 600
rounded:
  control: "9px"
  card: "12px"
  primary: "14px"
spacing:
  compact: "8px"
  normal: "12px"
  section: "24px"
components:
  button-primary:
    backgroundColor: "{colors.gold}"
    textColor: "{colors.ink}"
    rounded: "{rounded.primary}"
    typography: "{typography.display}"
  button-secondary:
    backgroundColor: "#8bc7bd"
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
    typography: "{typography.label}"
  supply-card:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    rounded: "{rounded.card}"
    padding: "12px 10px 16px"
---

# Design System: PenguCrush

## Overview

**Creative North Star: "The Illustrated Expedition"**

A descriptive record of the implemented world: outlined penguins, island scenery and collectible pieces sit inside tactile, matte controls. Bold display lettering carries the adventure; compact interface text keeps moves, goals, inventory and navigation legible. This is an incumbent-system record, not a new visual direction.

**Key Characteristics:**

- Illustrated scenery and distinct piece silhouettes.
- Navy contours, cream surfaces, gold actions and teal accents.
- Short, hard shadows and rounded rectangular controls.

## Colors

Gold identifies major actions, rewards and active navigation. Teal supports secondary actions and game scenery; red supplies warm emphasis. Ink carries text, contours and structural shadows; paper provides the common surface. The lighter shop paper supports commerce rows and confirmation panels. Inactive navigation uses its darker recorded token.

## Typography

Lilita One provides headings, major action labels and game numerals. Rubik provides instructions, commerce details and labels. Observed scale is contextual: prominent section headings (39px, with responsive reductions), shop headings (30px), main action text (23px), and commerce prose (13px). Preserve the compact game hierarchy rather than imposing a marketing-page type scale. Both font families are bundled locally.

## Layout

A portrait app shell fills screens up to the existing mobile breakpoint (540px); wider browser windows center a shell with a maximum width of 430px. Height-sensitive styles fit the board, HUD and tools. Commerce and inventory scroll vertically while their footer stays accessible. Supply cards use two columns; SOL bundles use stacked horizontal rows. The footer divides six destinations evenly, with labels under icons.

## Elevation & Depth

Navy strokes (usually 2–3px) and short solid shadows create tactile depth: primary controls lift 5px, cards 4px and smaller controls 3px. Pressing a button translates it downward and reduces its shadow. Illustrated backgrounds carry atmosphere; interface controls remain matte. The sidecar records shadow and motion values that do not fit the token schema.

## Shapes

Rounded rectangles dominate controls and cards. Smaller badges use tighter corners or circles. Existing illustrations, SVG pieces and Phosphor icons retain their silhouettes. New power icons use the same navy contour, with ice-blue and lilac fills to distinguish them.

## Components

- **Buttons:** gold primary, muted teal secondary, navy-on-cream icon controls. Retain pressed depth, disabled state and visible keyboard focus. Native sizing can enlarge a control without changing its appearance.
- **Cards:** cream or pale coloured surfaces, navy borders and solid offset shadows; inventory remains compact and readable.
- **Fields:** ranking selectors use cream fill, navy border, rounded corners and a minimum height of 48px.
- **Navigation:** cream bar with navy top rule; the active icon receives a gold outlined backplate and ink label. Inactive icons and labels share the recorded darker colour.
- **Board and powers:** quiet alternating teal cells let illustrated pieces lead. Gold target highlighting marks Polar Blast; lilac marks Aurora Sweep. Keep confirmation beside the preview explanation. Detailed behavior belongs to the booster/navigation surface brief.
- **Motion:** brief press, board movement and arrival feedback support state changes. Respect the existing animation preference and `prefers-reduced-motion` overrides.

## Do's and Don'ts

- **Do** preserve the illustrated assets, bundled typefaces and navy contour vocabulary.
- **Do** use existing CSS in cascade order: `style.css`, `expedition.css`, `campaign.css`, `commerce.css`, then `boosters.css`.
- **Do** retain visible focus, readable state feedback and reduced-motion behavior.
- **Don't** restore the superseded pastel gradients, soft shadows or Nunito declarations from the base stylesheet as the current visual system.

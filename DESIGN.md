---
name: Cosmos de Amélia
description: A private, data-first portrait of a year in reading, music and screens, coloured by Hubble's ultraviolet Jupiter.
colors:
  space: "#08080C"
  deep: "#111019"
  zone: "#EDF1FA"
  haze: "#B7B9D2"
  dim: "#7D7F9C"
  line: "rgba(237,241,250,.1)"
  belt-read: "#F2A8C7"
  belt-music: "#84CDEE"
  belt-screen: "#B5A2EC"
  pole: "#A86A4E"
  spot: "#3948CF"
typography:
  display:
    fontFamily: "Bricolage, ui-sans-serif, system-ui, sans-serif"
    fontSize: "clamp(34px, 4.2vw, 56px)"
    fontWeight: 700
    lineHeight: 1
    letterSpacing: "-0.035em"
  headline:
    fontFamily: "Bricolage, ui-sans-serif, system-ui, sans-serif"
    fontSize: "clamp(32px, 3.4vw, 44px)"
    fontWeight: 700
    lineHeight: 1.1
    letterSpacing: "-0.035em"
  title:
    fontFamily: "Bricolage, ui-sans-serif, system-ui, sans-serif"
    fontSize: "19px"
    fontWeight: 700
    letterSpacing: "-0.01em"
  body:
    fontFamily: "Hanken, ui-sans-serif, system-ui, sans-serif"
    fontSize: "16px"
    fontWeight: 400
    lineHeight: 1.5
    fontFeature: "\"tnum\" 1"
  label:
    fontFamily: "Hanken, ui-sans-serif, system-ui, sans-serif"
    fontSize: "13px"
    fontWeight: 400
rounded:
  cell: "2px"
  tile: "3px"
  bar: "4px"
  pill: "999px"
spacing:
  gutter: "clamp(16px, 4vw, 56px)"
  figure-gap-row: "48px"
  figure-gap-col: "56px"
  section-top: "56px"
components:
  period-control:
    textColor: "{colors.haze}"
    rounded: "{rounded.pill}"
    padding: "6px 14px"
  period-control-selected:
    backgroundColor: "{colors.zone}"
    textColor: "{colors.space}"
    rounded: "{rounded.pill}"
  heat-cell-empty:
    backgroundColor: "{colors.deep}"
    rounded: "{rounded.cell}"
---

# Design System: Cosmos de Amélia

## Overview

**Creative North Star: "The Atmosphere of the Year"**

The page is Jupiter seen in ultraviolet: a black field, and across it parallel belts of pink, cyan and lavender. Each belt is one of her habits (reading, music, screens) laid out day by day, and every section below reads the same history with the grids of her Reading Atlas plugins. The data is the picture. The one photograph, Hubble's UV Jupiter, appears small: as the brand mark and beside the "now" lines. It is never a backdrop.

Density is high but calm: figures sit on the black ground with no cards, separated only by space and hairlines. Copy is first person, Portuguese, one plain line per figure. The user rejected a photo-led version that "parecia slides" and dropped the data; that rejection is the main boundary of this system.

**Key Characteristics:**
- Black ground, pale-zone text, three belt colours with equal standing.
- Quartile heat ramps (five steps of her own history) for every day and hour grid.
- The same views for all three streams: day belts, an hour-by-weekday grid, a "now" line, a ranked list.
- No cards, no glows, no full-bleed imagery.

## Colors

A near-black field with pastel belts sampled from the UV Jupiter photograph, plus two of the planet's accents used for meaning, not decoration.

### Primary
- **Pink Belt** (#F2A8C7): reading. Day belt, hours grid, shelf spines, fingerprint strips, library squares, section title.
- **Cyan Belt** (#84CDEE): music. Also the focus ring, accent and caret colour.
- **Lavender Belt** (#B5A2EC): screens. Also tints text selection.

### Tertiary
- **Polar Rust** (#A86A4E): something interrupted or revisited: a paused book, a stopped series, a re-read stretch.
- **Spot Blue** (#3948CF): today. It strokes the current day in every belt inside a thin pale-zone ring, as the spot sits in its pale collar on the planet, and is used nowhere else.

### Neutral
- **Space** (#08080C): page ground.
- **Deep** (#111019): empty cells and meter tracks; the zero step of every ramp.
- **Pale Zone** (#EDF1FA): primary text.
- **Haze** (#B7B9D2): secondary text, captions, values.
- **Dim** (#7D7F9C): axis labels and rank numbers.
- **Line** (rgba(237,241,250,.1)): hairlines between list rows and sections.

### Named Rules
**The Equal Belts Rule.** Reading, music and screens always get the same view types and the same visual weight. A view added to one stream is added to the other two or justified by the data.

**The Quartile Rule.** Heat steps come from quartiles of her own non-zero history (ramp: deep, 30%, 52%, 76%, full belt colour), never from fixed thresholds, so a light month and a heavy month both show their shape.

**The One Spot Rule.** Spot blue marks today and only today.

## Typography

**Display Font:** Bricolage Grotesque (self-hosted, with ui-sans-serif fallback)
**Body Font:** Hanken Grotesk (self-hosted, tabular figures on)

**Character:** A slightly quirky grotesque for titles against a quiet, even text face; numbers line up because every figure is tabular.

### Hierarchy
- **Display** (700, clamp(34px, 4.2vw, 56px), 1): the period title; the date part set at 300 in haze.
- **Headline** (700, clamp(32px, 3.4vw, 44px)): section names, in the section's belt colour.
- **Title** (700, 19px): figure titles, always in first person ("Quando eu leio").
- **Body** (400, 16 to 19px, 1.5): lede and list rows; captions at 14px in haze, max about 56ch, `text-wrap: pretty`.
- **Label** (400, 12 to 13px): axes, values, ranks, metadata.

## Layout

A centred column up to 1440px with a fluid gutter (clamp(16px, 4vw, 56px)). The overview is two columns: the belts take the remaining width, the "now" aside is 300px. Stream sections use a 12-column grid with 48px row gaps and 56px column gaps; figures span 6 (half), 7 (wide) or the full row, and Leitura stacks the shelf and library map in the right five columns beside the hours grid and the fingerprints. Below 1100px every figure takes the full row and the aside sits under the belts; below 640px the nav wraps under the brand, the belts' labels move above each belt and the page opens on the month instead of the year. The header is sticky with a translucent space background.

## Elevation & Depth

Flat. There are no shadows. Depth comes only from the heat ramps (brighter means more time) and from hairlines. The header's blur is functional, so content stays readable under it while scrolling.

## Shapes

Small, soft corners on data marks: 2px on grid cells, 3px on tiles and map squares, 4px on bars, pill for the period control and progress meters. The planet is the only circle.

## Components

- **Period control:** a pill radiogroup (semana, mês, ano) with arrow-key movement; the selected option inverts to pale zone on space. Changing it re-renders the belts, totals, hour grids, tracks, artists and feelings.
- **Day belts:** an SVG grid per stream (53 week columns by 7 rows for a year, a strip of square days for a month, seven wide tiles for a week). Future days are outlined only. Hover or tap writes the day into a live readout line. On a period change, cells fill from 25% to full opacity left to right (520ms, cubic-bezier(.16,1,.3,1)), skipped under reduced motion.
- **Hours grid:** 24 by 7 SVG, weekday labels at left, 0h, 6h, 12h and 18h on top, with a one-line peak sentence in the caption. On phones the cells tighten (11px, 2px gap) so the labels still render at 12px or more.
- **Now lines:** a 14 by 6 belt swatch inline before the verb, the item in italics, metadata in haze, and an optional 3px meter in the belt colour.
- **Shelf:** spines with height by pages and width by hours; every title stands rotated above its spine in haze, whole, never truncated. Open books stand apart, outlined, filled to progress; paused ones in polar rust.
- **Fingerprint:** one strip per book, one mark per ten pages, lighter where she lingered; re-read stretches get a rust mark below.
- **Ranked lists:** rank, name, a belt-coloured bar and a value, separated by hairlines; artists flow into two columns on wide screens.

## Do's and Don'ts

- Do keep the data at the centre; the photograph stays small.
- Do give each of the three streams the same view types.
- Do label every demonstration value as sample data until the job feeds real data.
- Don't use cards, glows, gradient text or full-bleed imagery.
- Don't use coloured side stripes on list items; carry the colour with the inline swatch.
- Don't truncate book titles in the shelf.
- Don't use spot blue for anything except today.

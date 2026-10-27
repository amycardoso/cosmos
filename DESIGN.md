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
- One section where the streams meet: a constellation of books, artists and shows, and each book's soundtrack.
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

A centred column up to 1440px with a fluid gutter (clamp(16px, 4vw, 56px)). The page reads summary first, connections in the middle, details last: overview, Conexões, Leitura, Música, Telas. The overview is two columns: the belts take the remaining width, the "now" aside is 300px. Sections use a 12-column grid with 48px row gaps and 56px column gaps; figures span 5 (narrow), 6 (half), 7 (wide) or the full row. Conexões holds the constellation and the shared hours grid at full width; Leitura puts the shelf (7) beside the library map (5) above the fingerprints; Música puts the tracks (5) beside the artists (7); Telas puts the shows (7) beside a stack of feelings and films (5). Below 1100px every figure takes the full row and the aside sits under the belts; below 640px the nav wraps under the brand, the belts' labels move above each belt and the page opens on the month instead of the year. The header is sticky with a translucent space background.

## Elevation & Depth

Flat. There are no shadows. Depth comes only from the heat ramps (brighter means more time) and from hairlines. The header's blur is functional, so content stays readable under it while scrolling.

## Shapes

Small, soft corners on data marks: 2px on grid cells, 3px on tiles and map squares, 4px on bars, pill for the period control and progress meters. The planet is the only circle.

## Components

- **Period control:** a pill radiogroup (semana, mês, ano) with arrow-key movement; the selected option inverts to pale zone on space. Changing it re-renders the belts, totals, hour grids, tracks, artists and feelings.
- **Day belts:** an SVG grid per stream (53 week columns by 7 rows for a year, a strip of square days for a month, seven wide tiles for a week). Future days are outlined only. Hover or tap outlines that day in all three belts and writes all three values into the readout line.
- **Hours grid ("Como o dia se divide"):** one 24 by 7 SVG for all three streams. Each hour is a cell split into three stripes (reading, music, screens), each on its own quartile ramp; a pill radiogroup (os três, leitura, música, telas) draws one stream alone in whole cells. Hover or tap names the hour and a level word per stream. One peak sentence per stream sits under the grid with its swatch.
- **Constellation:** books, artists and shows as circles in their belt colour, sized by hours in the year. A solid line joins an artist to the book that was open while they played (thicker with more minutes); a dashed line joins a book to a show or film from the same weeks. Laid out once by a small force pass and label-collision pass, so it is still when it appears. Hover, tap or focus a star to dim everything outside its constellation and write one first-person sentence about it.
- **Soundtrack:** under each fingerprint, a 6px bar on deep: one cyan stretch per artist heard while reading (full, 65% and 40% cyan), the rest silence, and a line with the minutes and the share read in silence. Time read before the music history began is left out and said so.
- **Now lines:** a 14 by 6 belt swatch inline before the verb, the item in italics, metadata in haze, and an optional 3px meter in the belt colour.
- **Shelf:** face out, like bookshelf.koplugin: each book stands by its cover (2:3), its height by pages, on shelves that wrap into more rows as the year fills. Finished books in the order she finished them; open ones stand apart, the unread part of the cover in shadow above a belt-coloured line at the page she reached, paused ones desaturated with a polar rust line. A book with no cover found is a pink-tinted tile with its whole title.
- **Fingerprint:** one strip per book, one mark per ten pages, lighter where she lingered; re-read stretches get a rust mark below.
- **Ranked lists:** rank, name, a belt-coloured bar and a value, separated by hairlines; artists flow into two columns on wide screens.

## Motion

Motion carries information and happens once; only today's ring and the planet keep moving. Every effect uses cubic-bezier(.16,1,.3,1) and is skipped under reduced motion.

- **Belts:** on load and on a period change, cells fill from 15% to full opacity left to right (560ms, up to 520ms of stagger), each belt 80ms behind the one above.
- **Totals:** the lede's three totals count to their new value (900ms) instead of jumping.
- **Today:** the pale ring around today's spot breathes to 25% opacity every 3.2s.
- **Planet:** the UV Jupiter in the "now" aside turns once a minute, features crossing the disc left to right. Hubble saw one face, so the photo is unrolled into a map of that face (out to 70 degrees). The far side is the same bands softened, with only a faint trace of the face's detail, and the two meet in a long cross-fade, so no seam or mirror line shows. The limb darkening is taken out and laid back on as it is drawn. It pauses off screen and stays a still photo under reduced motion.
- **Nebula:** behind the Conexões constellation only, a procedural nebula drawn in the same UV palette (not a photo), faded out at its edges with a radial mask and drifting over two minutes; still under reduced motion. It is atmosphere for the stars, never a full-bleed section.
- **Figures:** a figure below the fold rises 10px and fades in once when it reaches the screen. Figures already in view never hide.
- **Hours grid:** hours light up from 0h to 23h (22ms apart).
- **Shelf:** books rise onto the shelf the first time it is seen.
- **Constellation:** stars fade in, then the lines draw from book to star.
- **Menu:** the section on screen is marked in pale zone with an underline.

## Do's and Don'ts

- Do keep the data at the centre; the photograph stays small.
- Do give each of the three streams the same view types.
- Do label every demonstration value as sample data until the job feeds real data.
- Don't use cards, glows, gradient text or full-bleed imagery.
- Don't use coloured side stripes on list items; carry the colour with the inline swatch.
- Don't truncate book titles in the shelf.
- Don't use spot blue for anything except today.

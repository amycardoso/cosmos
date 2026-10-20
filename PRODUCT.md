# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

Delegated: static site built with Astro, hosted on Cloudflare Pages behind Cloudflare Access (email allowlist). A scheduled job (GitHub Action) pulls the sources, computes aggregates and rebuilds. The first layout is plain HTML/CSS/JS so it drops into Astro unchanged. Chosen because the site must be private, needs no server, and stays free.

## Users

Amélia, and a few people she chooses to let in. She visits to see herself: what she has been reading, listening to and watching, and how those rhythms look over time. Friends she allows in visit to know her a little better.

## Product Purpose

A private personal site that represents Amélia through three streams of her life: reading, music, and series and films. It updates on its own from the services she already uses. Success is that she opens it because she likes looking at it and recognises herself in it.

## Positioning

Not a stats dashboard for a service. It joins three private streams that no single app shows together, including data only her e-reader keeps (per-page reading time, the hour and weekday she reads), and draws them as one personal map.

## Operating Context

- Reading: KOReader on a Kindle, with bookshelf.koplugin and her own Reading Atlas modules (github.com/amycardoso/reading-atlas: Atlas year, Atlas hours, Atlas map, planned book fingerprint and year's shelf). KOReader syncs statistics.sqlite3 to WebDAV.
- Music: Spotify, via the Web API in development mode (her own account only; recently played returns only the last 50 plays, so history accumulates over time).
- Series and films: Bingers, via its REST API (Legend plan; watch history with dates and ratings, watchlist statuses such as watch next, caught up, collecting dust, and feelings per episode: shocked, touched, amused, scared, bored, thrilled, confused, tense).
- Language: Brazilian Portuguese.

## Capabilities and Constraints

- Private. Never publicly reachable; access only through the allowlist.
- No secrets in the browser: tokens live in the scheduled job, the site receives computed aggregates only.
- Data refreshes on a schedule (hourly at most), so "now playing" is "recently", not live.
- The three streams have equal weight. None of them is the headline.
- Open: whether a public, delayed, aggregate-only version ever exists.

## Brand Commitments

- Theme she asked for: cosmos ("um negócio meio cosmos").
- Must feel authentic and beautiful. She would hate it looking like a corporate dashboard or like something cute.
- Visual direction (2026-10-19): after seeing sketches of an almanac/ephemeris world and a glass-plate world, she chose the familiar dark, starry "space" dashboard. Convention is the commitment: execute it at full craft, never as a generic template.
- Revised 2026-10-20: she rejected a build led by full-bleed Webb nebula photos ("parecendo slides", and it dropped the atlas data). Approved instead: a data-first page on black whose colours come from Hubble's ultraviolet Jupiter (pink, cyan, lavender belts, rust poles, deep-blue spot). The Reading Atlas views (year grid, hours grid, library map, fingerprint, year's shelf) are the core vocabulary, mirrored for music and screens. The photo appears small, never as a backdrop.

## Evidence on Hand

- Reading Atlas code and screenshots: docs/img/ in the reading-atlas repo.
- No real Spotify, Bingers or reading exports yet. Any demonstration data in the layout is synthetic and labelled as such.

## Product Principles

1. It is a portrait, not a report: every view should say something about her, not just count.
2. Three streams, one sky: reading, music and screens share one visual language and equal standing.
3. Intimate by default: show patterns, never expose more than she chose to share.
4. Quiet automation: it fills itself in; she never has to log anything for it.

# Cosmos

A private site with my year in reading, music, and series and films, in the colours of Hubble's ultraviolet Jupiter.

![The site with sample data: Jupiter turning, the three day-by-day belts lighting up the same day, the period switch, the constellation linking books to the music and shows around them, the shared hours grid, each book's soundtrack, and the music and screens sections](docs/cosmos.gif)

<sub>Recorded with the sample data in `site/data/cosmos.js`.</sub>

- `site/`: the site itself (plain HTML, CSS and JS), in four pages: `index.html` (the year at a glance and the connections), `leitura.html`, `musica.html` and `telas.html`. Open any of them to see it with sample data.
- `site/data/cosmos.js` and `site/data/archive.js`: sample data in the exact shape the job produces. Nothing in them is real.
- `job/`: the scheduled job that reads the real sources and builds the site.
- `DESIGN.md`: the visual system. `PRODUCT.md`: what the site is and who it is for.
- `archive/webb/`: the first version, built around James Webb nebulae, kept for reference (without its images).

## How the data gets in

Every three hours, `.github/workflows/deploy.yml` runs `npm run build`, which:

1. downloads KOReader's `statistics.sqlite3` from WebDAV (KOReader's own statistics cloud sync puts it there) and turns it into the Reading Atlas views: time per day, the hours grid, the shelf, the library by language and each book's fingerprint. Covers come from Open Library (Google Books as a fallback), downloaded at build time and served from the site itself;
2. asks Spotify for the latest plays and adds them to a history the job keeps, because Spotify only remembers the last 50;
3. mirrors the Bingers library through `/v1/entries` and its change cursor, plus the library and the season of each show in progress;
4. crosses the three timelines: what played on Spotify while each book was open, how much of each book was read in silence, and which shows shared their weeks with a book. Only those links reach the site, never the raw plays or sessions;
5. sums up the whole Spotify history for the music page's "Dez anos" (artists year by year, genres, obsessions, skips, this day in past years, first listens). Genres come from MusicBrainz, since Spotify no longer fills them in for most artists: each run looks up about 50 more artists, most listened first, and keeps the answers;
6. writes `dist/` with the real data in `dist/data/cosmos.js` (and the music page's long view in `dist/data/archive.js`), and deploys it to Cloudflare Pages.

If one source fails, the site keeps that source's last good read and says so in the footer.

### The full Spotify history

The API only ever sees forward, so everything before the job's first run comes from Spotify's Extended Streaming History export (Account → Privacy, delivered by email). It is folded in by hand, on my own computer, never through the repository:

```sh
npx wrangler kv key get spotify-history --namespace-id <id> --remote > current.json.gz
npm run spotify-import -- history.json.gz skips.json.gz current.json.gz "path/to/Spotify Extended Streaming History"
npx wrangler kv key put spotify-history --namespace-id <id> --remote --path history.json.gz
npx wrangler kv key put spotify-skips --namespace-id <id> --remote --path skips.json.gz
rm current.json.gz history.json.gz skips.json.gz
```

The export replaces whatever the job kept up to its last play, so importing a newer export later works the same way. Podcasts, audiobooks and plays under 30 seconds are left out of the history. Skips only exist in the export, so the import counts them once into `spotify-skips`, and the page shows them as of the export's last day.

### Seeding the genres

MusicBrainz turns GitHub's shared runners away after a few requests, so the first few hundred artists are looked up from my own computer (about three seconds each):

```sh
npx wrangler kv key get spotify-history --namespace-id <id> --remote > history.json.gz
npx wrangler kv key get artist-genres --namespace-id <id> --remote > current.json.gz
npm run genres-seed -- genres.json.gz history.json.gz current.json.gz 600
npx wrangler kv key put artist-genres --namespace-id <id> --remote --path genres.json.gz
rm history.json.gz current.json.gz genres.json.gz
```

The build keeps adding the rest, a few each run. Until half of the listening hours have a genre, the music page says how far along it is instead of drawing the genres.

## Privacy

The repository is public; the data is not.

- Tokens live only in GitHub Actions secrets.
- The data never touches the repository: the job deploys straight to Cloudflare, uploads no artifacts and prints nothing but which sources worked.
- What has to survive between runs (the Spotify history and skips, the artists' genres, the Bingers mirror, each source's last good read) lives in a Cloudflare KV namespace.
- The site sits behind Cloudflare Access, so only the people I allow can open it.

## Setup

1. **Cloudflare.** Create a Pages project named `cosmos` (Direct Upload), a KV namespace, and an API token with *Cloudflare Pages: Edit* and *Workers KV Storage: Edit*. In Zero Trust, add an Access application for the Pages domain that allows only my email.
2. **Spotify.** Create an app at developer.spotify.com with the redirect URI `http://127.0.0.1:8888/callback`, then run `SPOTIFY_CLIENT_ID=… SPOTIFY_CLIENT_SECRET=… npm run spotify-auth` on my own computer to get the refresh token.
3. **Bingers.** Create a read-only personal token at bingers.app/integrations (Legend plan).
4. **KOReader.** Turn on cloud sync in the statistics plugin, pointing to a WebDAV folder. The URL secret is the full path of `statistics.sqlite3` in that folder.
5. **GitHub secrets.** `WEBDAV_URL`, `WEBDAV_USER`, `WEBDAV_PASSWORD`, `SPOTIFY_CLIENT_ID`, `SPOTIFY_CLIENT_SECRET`, `SPOTIFY_REFRESH_TOKEN`, `BINGERS_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_API_TOKEN`, `COSMOS_KV_NAMESPACE`. If the Pages project has another name, set the repository variable `COSMOS_PAGES_PROJECT`.
6. Run **Probe sources** once from the Actions tab. It prints only the shape of each API response, never values, so the readers can be checked against the real APIs. Then run **Build and deploy**.

## Develop

```sh
npm install
npm test             # job tests, with synthetic fixtures
npm run build        # builds dist/ with whatever credentials are in the environment
```

Without Cloudflare variables, the job keeps its state in `.state/` (ignored by git).

Jupiter image: NASA, ESA, Hubble.

# Plex Rewind

A personal "year in review" of your own Plex activity, built from Tautulli history. Each library gets its own view:

- **Music**: weekly timelines of top artists and top songs, plus top artists, songs and albums. Versions of a song (live, acoustic, demo, remaster, take N, remix, session…) are merged into one song.
- **TV**: weekly top shows, top shows and most-watched episodes.
- **Movies**: movies per week and most-watched movies.
- **Audiobooks**: artist-type libraries whose name contains "audiobook", "book" or "podcast": top books and authors.

Every view also has headline stats, a day/hour heatmap and a breakdown by device. The timelines support legend toggling, zoom, stacked, line or table views, and clicking a week opens its full chart.

Date range defaults to year to date, with presets and a custom range. Library and range live in the URL, so a view can be bookmarked.

## Setup

Create `.env` (gitignored) in the project root:

```sh
TAUTULLI_API_KEY=your-key          # Tautulli → Settings → Web Interface → API
TAUTULLI_URL=http://10.0.0.20:8181 # optional, this is the default
TAUTULLI_USER=username             # optional, this is the default; Plex username or Tautulli friendly name
```

Then:

```sh
pnpm install
pnpm dev        # http://localhost:5173
```

The browser never sees the API key. The Vite server proxies `/tautulli?cmd=…` to Tautulli's `/api/v2` and adds the key. Because of that, run it with `pnpm build && pnpm preview` rather than serving `dist/` from a static host.

## Notes

- Only `TAUTULLI_USER`'s plays are shown, across every library.

- Music plays shorter than 30 seconds count as skips and are left out. Audiobook chapters under 60 seconds are left out too.
- History is fetched with Tautulli's grouping on, so a resumed session counts as one play.
- Song title cleanup lives in `src/lib/normalize.ts`; per-library charts and stats are configured in `src/views/configs.ts`.

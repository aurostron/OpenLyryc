# OpenLyryc Web

This is the Next.js app for OpenLyryc. It contains the studio, stage view, lyrics player, chords page, karaoke page, and the Unison Hub client.

Start from the root of the repo:

```bash
npm install
npm run build:packages
npm run dev
```

The app runs at [http://localhost:3000](http://localhost:3000).

Read the root [README](../../README.md) for the project overview and [docs/CONTRIBUTING.md](../../docs/CONTRIBUTING.md) before sending a PR.

## Notes

- The app is a static export. `npm run build` writes to `apps/web/out`.
- Local audio stays in the browser. Shared links and Unison Hub use the hosted services.
- Production deployment files and Unison Hub server code are not part of this repo.

# Contributing to OpenLyryc

Thanks for wanting to help. This guide is short on purpose.

## What you need

- Node 20.9 or newer
- npm 10 or newer
- git

## Get it running

```bash
git clone https://github.com/aurostron/openlyryc.git
cd openlyryc
npm install
npm run build:packages
npm run dev
```

The app is at [http://localhost:3000](http://localhost:3000).

`npm run dev` also starts two small servers:

- Port `3099`: YouTube and SoundCloud proxy
- Port `4444`: WebRTC signaling for live collab

You can ignore both if you are only working on local files and the editor.

## Commands

| Command | What it does |
| --- | --- |
| `npm run dev` | Start the web app and the two dev servers |
| `npm run build:packages` | Type-check and build the shared packages |
| `npm run build` | Build the web app and export the static site |
| `npm run lint` | Run ESLint on the web app |
| `npm run companion` | Run the local companion bridge on port 4040 |

There is no unit test command right now. If you change the parser, test it in the studio with a real file and describe what you checked in the PR.

## Good first issues

- Bugs in LRC or TTML import and export
- Keyboard and screen reader problems in the studio
- Slow waveform or stage rendering on low-end machines
- Unclear error messages
- Documentation fixes

## Code rules

- Keep TypeScript strict. Avoid adding `any`.
- Audio processing stays local. Do not upload a user's audio file to a server.
- Do not put secrets, tokens, or database IDs in source files. Use `.env.local`.
- Match the existing UI: zinc and neutral colors, thin borders, small radii, no random accent colors.
- Write copy like a person. No "seamless", "unleash", or "revolutionary".
- Comments should explain why something is done, not repeat the code.

## Pull requests

1. Fork the repo and make a branch.
2. Make a focused change. One feature or one fix per PR.
3. Run `npm run build:packages` and `npm run lint`.
4. Run `npm run build` if you touched shared packages or routing.
5. In the PR, say what changed, what you tested, and what you could not test.

Screenshots or a short screen recording help for UI changes.

## Please do not commit

- `.env.local`, `.env.production`, or any real token
- Build output (`.next/`, `out/`, `dist/`)
- Art, fonts, or audio you do not have permission to share
- Code copied from a project whose license does not allow it

## What lives elsewhere

Unison Hub's server, database, account system, and deployment setup are not in this repo. The public client can talk to the hosted service, but you need an account to use it.

The production Cloudflare config and internal maintenance scripts are also private. Local development does not need them.

## Security

Do not open a public issue for a security problem. Email `security@openlyryc.dev` or message the maintainer directly.

## License

By sending a pull request, you agree that your contribution is licensed under the MIT license.

# Wren

A calm, free Markdown writer: focus mode, syntax highlight, live preview, version history, export.
Use it in the browser or install the Mac app.

```
website/              static site served by GitHub Pages
  index.html          landing page with download buttons
  app/                the web app
desktop/              Electron wrapper + make-dmg.sh (macOS only)
.github/workflows/
  pages.yml           deploys website/ to GitHub Pages on every push to main
  release-mac.yml     builds Wren.dmg on a macOS runner and attaches it to a Release
```

## Publish
1. Create a GitHub repo and push this folder to `main`.
2. **Settings → Pages → Build and deployment → Source: GitHub Actions.** The site goes live at
   `https://<user>.github.io/<repo>/` (web app at `/app/`).
3. Create the Mac download: **Releases → Draft a new release → tag `v1.0.0` → Publish**
   (or push the tag `git tag v1.0.0 && git push --tags`). The *Build Wren.dmg* workflow attaches
   `Wren.dmg`; the site's download button always points to the latest release.

## Local use
- Web: `npx serve website`
- Mac app, run: `cd desktop && npm install && npm start`
- Mac app, .dmg (on a Mac): `cd desktop && npm install && npm run dist` → `desktop/dist/Wren.dmg`

## Notes
- The app is ad-hoc signed, not notarized. First launch: right-click → Open, or
  `xattr -cr /Applications/Wren.app`.
- Documents are stored in the browser/app local storage. Nothing is uploaded.

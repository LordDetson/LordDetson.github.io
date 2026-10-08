# lorddetson.github.io

Personal support page of Dmitry Babanin: https://lorddetson.github.io

One page in English and Russian. The language comes from `?lang=en|ru` in the link, then the visitor's
choice in the RU / EN switch, then the browser language (ru, be, uk, kk get Russian, everything else English).

- `content/en.json`, `content/ru.json` hold the texts; both must have the same structure.
  Every text goes into the page twice, with `lang="en"` and `lang="ru"`, and the stylesheet shows one of them.
  Short prefixes use a non-breaking hyphen (`3D‑модели`, `one‑time`), and `18650` keeps a non-breaking space,
  so they never hang alone at the end of a line.
- `assets/media/` holds the pictures (`<id>.webp`) and silent loop videos (`<id>.mp4`) of PiPoker and every
  model in `models`. A model without a video shows only its picture. Strip metadata from new videos
  (`ffmpeg -i in.mp4 -map 0:v -c copy -map_metadata -1 -movflags +faststart out.mp4`): phones store the
  location, and a test fails on it.
- `wallets.json` holds the crypto wallets. The crypto section appears only when it is not empty.
  Each wallet has a unique `id` (a-z, 0-9, "-"), `chain` (`tron`, `ton` or `bitcoin`), `coin`, `network`
  and `address`; the build refuses an address with a wrong checksum.
- Every file is linked as `/<path>?v=<hash>`, so a deploy never mixes new HTML with a cached old file.
- `npm test` checks the texts, the pages, the scripts in a sandbox and that every QR code decodes to its address.
- `npm run build` writes the site to `dist/`. Pushing to `main` tests it and deploys it to GitHub Pages.

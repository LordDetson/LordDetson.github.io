# lorddetson.github.io

Personal support page of Dmitry Babanin: https://lorddetson.github.io

One page in English and Russian. The language comes from `?lang=en|ru` in the link, then the visitor's
choice in the RU / EN switch, then the browser language (ru, be, uk, kk get Russian, everything else English).

- `content/en.json`, `content/ru.json` hold the texts; both must have the same structure.
  Every text goes into the page twice, with `lang="en"` and `lang="ru"`, and the stylesheet shows one of them.
- `wallets.json` holds the crypto wallets. The crypto section appears only when it is not empty.
  Each wallet has `id`, `chain` (`tron`, `ton` or `bitcoin`), `coin`, `network` and `address`;
  the build refuses an address with a wrong checksum.
- `npm test` checks the texts, the pages and that every QR code decodes to its address.
- `npm run build` writes the site to `dist/`. Pushing to `main` tests it and deploys it to GitHub Pages.

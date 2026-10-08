# lorddetson.github.io

Personal support page of Dmitry Babanin: https://lorddetson.github.io (English) and https://lorddetson.github.io/ru/ (Russian).

- `content/en.json`, `content/ru.json` hold the texts; both must have the same structure.
- `wallets.json` holds the crypto wallets. The crypto section appears only when it is not empty.
  Each wallet has `id`, `chain` (`tron`, `ton` or `bitcoin`), `coin`, `network` and `address`;
  the build refuses an address with a wrong checksum.
- `npm test` checks the texts, the pages and that every QR code decodes to its address.
- `npm run build` writes the site to `dist/`. Pushing to `main` tests it and deploys it to GitHub Pages.

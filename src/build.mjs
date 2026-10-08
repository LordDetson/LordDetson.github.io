import { copyFile, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import QRCode from 'qrcode';

import { isValidAddress } from './validate.mjs';

const SITE_URL = 'https://lorddetson.github.io';
const ROOT = fileURLToPath(new URL('..', import.meta.url));
const ASSETS = ['style.css', 'copy.js'];

const PAGES = {
  en: { path: '', other: 'ru' },
  ru: { path: 'ru/', other: 'en' },
};

function escape(text) {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function fill(template, values) {
  return template.replace(/\{(\w+)\}/g, (_, key) => values[key]);
}

function checkWallets(wallets) {
  for (const wallet of wallets) {
    if (!isValidAddress(wallet.chain, wallet.address)) {
      throw new Error(`Wallet ${wallet.id} has an invalid ${wallet.chain} address: ${wallet.address}`);
    }
  }
}

function renderWallet(wallet, text) {
  const values = { coin: escape(wallet.coin), network: escape(wallet.network) };
  return `
        <section class="wallet" data-wallet="${escape(wallet.id)}">
          <h4>${values.coin} <span class="network">${values.network}</span></h4>
          <img class="qr" src="/qr/${escape(wallet.id)}.png" alt="${fill(escape(text.qrAlt), values)}" width="200" height="200">
          <code class="address">${escape(wallet.address)}</code>
          <button class="copy" type="button" data-address="${escape(wallet.address)}" data-copied="${escape(text.copied)}">${escape(text.copy)}</button>
          <p class="warning">${fill(escape(text.networkWarning), values)}</p>
        </section>`;
}

function renderCrypto(wallets, text) {
  if (wallets.length === 0) return '';
  return `
      <section id="crypto">
        <h3>${escape(text.title)}</h3>
        <p>${escape(text.text)}</p>
        <div class="wallets">${wallets.map((wallet) => renderWallet(wallet, text)).join('')}
        </div>
      </section>`;
}

function renderPage(lang, content, wallets) {
  const c = content[lang];
  const page = PAGES[lang];
  const other = PAGES[page.other];
  const projects = c.projects
    .map(
      (p) => `
        <li><a href="${escape(p.url)}">${escape(p.name)}</a><span>${escape(p.description)}</span></li>`,
    )
    .join('');
  const goals = c.goals.map((goal) => `
        <li>${escape(goal)}</li>`).join('');

  return `<!doctype html>
<html lang="${lang}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src 'self'; style-src 'self'; script-src 'self'; base-uri 'none'; form-action 'none'">
  <title>${escape(c.title)}</title>
  <meta name="description" content="${escape(c.description)}">
  <link rel="canonical" href="${SITE_URL}/${page.path}">
  <link rel="alternate" hreflang="en" href="${SITE_URL}/">
  <link rel="alternate" hreflang="ru" href="${SITE_URL}/ru/">
  <link rel="stylesheet" href="/style.css">
  <script src="/copy.js" defer></script>
</head>
<body>
  <main>
    <header>
      <a class="language" href="/${other.path}" hreflang="${page.other}">${escape(c.languageName)}</a>
      <h1>${escape(c.name)}</h1>
      <p class="role">${escape(c.role)}</p>
      <p class="intro">${escape(c.intro)}</p>
    </header>

    <section id="projects">
      <h2>${escape(c.projectsTitle)}</h2>
      <ul class="projects">${projects}
      </ul>
    </section>

    <section id="goals">
      <h2>${escape(c.goalsTitle)}</h2>
      <ul class="goals">${goals}
      </ul>
    </section>

    <section id="support">
      <h2>${escape(c.supportTitle)}</h2>

      <section id="boosty">
        <h3>${escape(c.boosty.title)}</h3>
        <p>${escape(c.boosty.text)}</p>
        <a class="button" href="${escape(c.boosty.url)}">${escape(c.boosty.button)}</a>
      </section>
${renderCrypto(wallets, c.crypto)}
    </section>

    <footer>
      <p>${escape(c.thanks)}</p>
    </footer>
  </main>
</body>
</html>
`;
}

export async function build({ content, wallets, outDir }) {
  checkWallets(wallets);

  await rm(outDir, { recursive: true, force: true });
  await mkdir(join(outDir, 'ru'), { recursive: true });
  if (wallets.length > 0) await mkdir(join(outDir, 'qr'), { recursive: true });

  for (const lang of Object.keys(PAGES)) {
    await writeFile(join(outDir, PAGES[lang].path, 'index.html'), renderPage(lang, content, wallets));
  }
  for (const wallet of wallets) {
    await QRCode.toFile(join(outDir, 'qr', `${wallet.id}.png`), wallet.address, {
      errorCorrectionLevel: 'M',
      margin: 2,
      scale: 8,
    });
  }
  for (const asset of ASSETS) {
    await copyFile(join(ROOT, 'assets', asset), join(outDir, asset));
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const read = async (path) => JSON.parse(await readFile(join(ROOT, path), 'utf8'));
  await build({
    content: { en: await read('content/en.json'), ru: await read('content/ru.json') },
    wallets: await read('wallets.json'),
    outDir: join(ROOT, 'dist'),
  });
  console.log('Built dist/');
}

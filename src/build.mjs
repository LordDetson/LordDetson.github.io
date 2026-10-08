import { copyFile, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import QRCode from 'qrcode';

import { langScript } from './language.mjs';
import { isValidAddress } from './validate.mjs';

const SITE_URL = 'https://lorddetson.github.io';
const ROOT = fileURLToPath(new URL('..', import.meta.url));
const ASSETS = ['style.css', 'copy.js'];

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

// The same element twice, once per language; the stylesheet shows only the chosen one.
function both(tag, en, ru, attributes = '') {
  return `<${tag}${attributes} lang="en">${escape(en)}</${tag}><${tag}${attributes} lang="ru">${escape(ru)}</${tag}>`;
}

function checkWallets(wallets) {
  for (const wallet of wallets) {
    if (!isValidAddress(wallet.chain, wallet.address)) {
      throw new Error(`Wallet ${wallet.id} has an invalid ${wallet.chain} address: ${wallet.address}`);
    }
  }
}

function renderWallet(wallet, { en, ru }) {
  const values = { coin: wallet.coin, network: wallet.network };
  return `
        <section class="wallet" data-wallet="${escape(wallet.id)}">
          <h4>${escape(wallet.coin)} <span class="network">${escape(wallet.network)}</span></h4>
          <img class="qr" src="/qr/${escape(wallet.id)}.png" alt="${escape(wallet.coin)} QR" width="200" height="200">
          <code class="address">${escape(wallet.address)}</code>
          <button class="copy" type="button" data-address="${escape(wallet.address)}">${both('span', en.copy, ru.copy, ' class="label"')}${both('span', en.copied, ru.copied, ' class="done"')}</button>
          ${both('p', fill(en.networkWarning, values), fill(ru.networkWarning, values), ' class="warning"')}
        </section>`;
}

function renderCrypto(wallets, text) {
  if (wallets.length === 0) return '';
  return `
      <section id="crypto">
        ${both('h3', text.en.title, text.ru.title)}
        ${both('p', text.en.text, text.ru.text)}
        <div class="wallets">${wallets.map((wallet) => renderWallet(wallet, text)).join('')}
        </div>
      </section>`;
}

function renderPage({ en, ru }, wallets) {
  const projects = en.projects
    .map((project, i) => {
      const other = ru.projects[i];
      return `
        <li><a href="${escape(project.url)}">${both('span', project.name, other.name)}</a>${both('span', project.description, other.description, ' class="description"')}</li>`;
    })
    .join('');
  const goals = en.goals.map((goal, i) => `
        ${both('li', goal, ru.goals[i])}`).join('');

  return `<!doctype html>
<html lang="en" data-lang="en" data-title-en="${escape(en.title)}" data-title-ru="${escape(ru.title)}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src 'self'; style-src 'self'; script-src 'self'; base-uri 'none'; form-action 'none'">
  <title>${escape(en.title)}</title>
  <meta name="description" lang="en" content="${escape(en.description)}">
  <meta name="description" lang="ru" content="${escape(ru.description)}">
  <link rel="canonical" href="${SITE_URL}/">
  <link rel="stylesheet" href="/style.css">
  <script src="/lang.js"></script>
  <script src="/copy.js" defer></script>
</head>
<body>
  <main>
    <header>
      <div class="lang-switcher" role="group" aria-label="Language / Язык">
        <button class="lang-switch" type="button" data-set-lang="ru" aria-pressed="false">RU</button>
        <button class="lang-switch" type="button" data-set-lang="en" aria-pressed="true">EN</button>
      </div>
      ${both('h1', en.name, ru.name)}
      ${both('p', en.role, ru.role, ' class="role"')}
      ${both('p', en.intro, ru.intro, ' class="intro"')}
    </header>

    <section id="projects">
      ${both('h2', en.projectsTitle, ru.projectsTitle)}
      <ul class="projects">${projects}
      </ul>
    </section>

    <section id="goals">
      ${both('h2', en.goalsTitle, ru.goalsTitle)}
      <ul class="goals">${goals}
      </ul>
    </section>

    <section id="support">
      ${both('h2', en.supportTitle, ru.supportTitle)}

      <section id="boosty">
        ${both('h3', en.boosty.title, ru.boosty.title)}
        ${both('p', en.boosty.text, ru.boosty.text)}
        <a class="button" href="${escape(en.boosty.url)}">${both('span', en.boosty.button, ru.boosty.button)}</a>
      </section>
${renderCrypto(wallets, { en: en.crypto, ru: ru.crypto })}
    </section>

    <footer>
      ${both('p', en.thanks, ru.thanks)}
    </footer>
  </main>
</body>
</html>
`;
}

export async function build({ content, wallets, outDir }) {
  checkWallets(wallets);

  await rm(outDir, { recursive: true, force: true });
  await mkdir(outDir, { recursive: true });
  if (wallets.length > 0) await mkdir(join(outDir, 'qr'), { recursive: true });

  await writeFile(join(outDir, 'index.html'), renderPage(content, wallets));
  await writeFile(join(outDir, 'lang.js'), langScript());
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

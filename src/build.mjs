import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { copyFile, cp, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import QRCode from 'qrcode';

import { langScript } from './language.mjs';
import { isValidAddress } from './validate.mjs';

const SITE_URL = 'https://lorddetson.github.io';
const ROOT = fileURLToPath(new URL('..', import.meta.url));
const MEDIA = join(ROOT, 'assets', 'media');
const ASSETS = ['style.css', 'copy.js', 'media.js', 'favicon.svg'];

const MODEL_SIZE = 720;
const PIPOKER_SIZE = { width: 1280, height: 800 };

const CSP = [
  "default-src 'none'",
  "img-src 'self'",
  "media-src 'self'",
  "style-src 'self'",
  "script-src 'self'",
  "base-uri 'none'",
  "form-action 'none'",
].join('; ');

// Inline SVG icons, stroked with currentColor (see .icon in style.css).
function icon(body, className = 'icon') {
  return `<svg class="${className}" viewBox="0 0 24 24" aria-hidden="true">${body}</svg>`;
}

const ICONS = {
  heart: icon('<path d="M12 20.5s-7.2-4.4-9.1-8.8C1.6 8.6 3.6 5 7.1 5c2 0 3.4 1.1 4.9 3 1.5-1.9 2.9-3 4.9-3 3.5 0 5.5 3.6 4.2 6.7-1.9 4.4-9.1 8.8-9.1 8.8z"/>'),
  arrowOut: icon('<path d="M7 17L17 7M8.5 7H17v8.5"/>'),
  arrowDown: icon('<path d="M12 5v14M6 13l6 6 6-6"/>'),
  card: icon('<rect x="2.5" y="5" width="19" height="14" rx="2.5"/><path d="M2.5 10h19M6.5 15h4"/>'),
  copy: icon('<rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V6a2 2 0 0 1 2-2h9"/>', 'icon icon-copy'),
  check: icon('<path d="M5 12.5l4.5 4.5L19 7.5"/>', 'icon icon-check'),
  github: icon('<circle cx="6" cy="18" r="2.5"/><circle cx="6" cy="6" r="2.5"/><circle cx="18" cy="8" r="2.5"/><path d="M6 8.5v7M18 10.5c0 4-4 4.5-9.5 6"/>'),
  boosty: icon('<path d="M3.5 10v4a1 1 0 0 0 1 1H7l7 4.5v-15L7 9H4.5a1 1 0 0 0-1 1zM17.5 9a4 4 0 0 1 0 6M20 6.5a7.5 7.5 0 0 1 0 11"/>'),
  cube: icon('<path d="M12 2.5l8.5 4.75v9.5L12 21.5l-8.5-4.75v-9.5L12 2.5zM3.5 7.25L12 12l8.5-4.75M12 12v9.5"/>'),
};

const CRAFT_ICONS = [
  icon('<path d="M8 7l-5 5 5 5M16 7l5 5-5 5"/>'),
  ICONS.cube,
  icon('<path d="M13 2.5L4.5 13.5h6.5l-1 8 8.5-11h-6.5l1-8z"/>'),
];

const GOAL_ICONS = [
  ['blue', icon('<rect x="3.5" y="4" width="17" height="6.5" rx="2"/><rect x="3.5" y="13.5" width="17" height="6.5" rx="2"/><path d="M7.5 7.25h.01M7.5 16.75h.01M11 7.25h5M11 16.75h5"/>')],
  ['orange', icon('<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="2.5"/><path d="M12 3.5v6M12 14.5v6M3.5 12h6M14.5 12h6"/>')],
  ['green', icon('<rect x="6.5" y="6.5" width="11" height="11" rx="1.5"/><rect x="9.5" y="9.5" width="5" height="5" rx=".5"/><path d="M9.5 3v3.5M14.5 3v3.5M9.5 17.5V21M14.5 17.5V21M3 9.5h3.5M3 14.5h3.5M17.5 9.5H21M17.5 14.5H21"/>')],
  ['violet', icon('<path d="M20.5 13.5A8.5 8.5 0 1 1 10.5 3.5a6.5 6.5 0 0 0 10 10z"/>')],
];

const BOOSTY_ART = `<svg class="boosty-art" viewBox="0 0 320 330" aria-hidden="true">
          <path class="hx" d="M160 18 236 62v88l-76 44-76-44V62z"/>
          <path class="hx" d="M84 150l76 44v88l-76 44-76-44v-88z"/>
          <path class="hx" d="M236 150l76 44v88l-76 44-76-44v-88z"/>
          <path class="hx-fill" d="M160 18 236 62v88l-76 44-76-44V62z"/>
          <path class="heart" d="M160 152s-38-23.5-47.4-46.8C106 88 117.2 70.5 134.4 70.5c10.2 0 18.3 5.6 25.6 15.3 7.3-9.7 15.4-15.3 25.6-15.3 17.2 0 28.4 17.5 21.8 34.7C198 128.5 160 152 160 152z"/>
        </svg>`;

const COIN_BADGES = {
  USDT: '₮',
  BTC: '₿',
  TON: '<svg viewBox="0 0 24 24"><path d="M5 6h14l-7 13L5 6zM12 6v13"/></svg>',
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

// The same element twice, once per language; the stylesheet shows only the chosen one.
function both(tag, en, ru, attributes = '') {
  return `<${tag}${attributes} lang="en">${escape(en)}</${tag}><${tag}${attributes} lang="ru">${escape(ru)}</${tag}>`;
}

function spans(en, ru, attributes = '') {
  return both('span', en, ru, attributes);
}

// The id becomes a file name in qr/, so it must be unique and plain.
function checkWallets(wallets) {
  const ids = new Set();
  for (const wallet of wallets) {
    if (!/^[a-z0-9-]+$/.test(wallet.id)) throw new Error(`Wallet id "${wallet.id}" may use only a-z, 0-9 and "-"`);
    if (ids.has(wallet.id)) throw new Error(`Wallet id ${wallet.id} is used twice`);
    ids.add(wallet.id);
    if (!isValidAddress(wallet.chain, wallet.address)) {
      throw new Error(`Wallet ${wallet.id} has an invalid ${wallet.chain} address: ${wallet.address}`);
    }
  }
}

// /path -> /path?v=<first 8 hex of sha256>, so a deploy never pairs new HTML with a cached old file.
async function versionsOf(outDir) {
  const versions = new Map();
  for (const entry of await readdir(outDir, { recursive: true, withFileTypes: true })) {
    if (!entry.isFile()) continue;
    const file = join(entry.parentPath ?? entry.path, entry.name);
    const path = `/${file.slice(outDir.length + 1).replace(/\\/g, '/')}`;
    versions.set(path, createHash('sha256').update(await readFile(file)).digest('hex').slice(0, 8));
  }
  return (path) => {
    if (!versions.has(path)) throw new Error(`No file for ${path}`);
    return `${path}?v=${versions.get(path)}`;
  };
}

function checkMedia(models) {
  for (const id of ['pipoker', ...models.map((m) => m.id)]) {
    if (!existsSync(join(MEDIA, `${id}.webp`))) throw new Error(`Missing picture assets/media/${id}.webp`);
  }
}

function hasVideo(id) {
  return existsSync(join(MEDIA, `${id}.mp4`));
}

// Videos start from media.js only when they are on screen. Model tiles show a lazy still picture under
// the video until it plays; that picture is also what reduced motion and a page without scripts show.
function video(v, id, { width, height }, { poster = false } = {}) {
  const posterAttr = poster ? ` poster="${v(`/media/${id}.webp`)}"` : '';
  const className = poster ? 'media' : 'media motion';
  return `<video class="${className}" width="${width}" height="${height}"${posterAttr} preload="none" muted loop playsinline data-autoplay aria-hidden="true"><source src="${v(`/media/${id}.mp4`)}" type="video/mp4"></video>`;
}

function still(v, id, { width, height }) {
  return `<img class="media still" src="${v(`/media/${id}.webp`)}" alt="" width="${width}" height="${height}" loading="lazy" decoding="async">`;
}

function sectionHead(number, id, en, ru) {
  return `<div class="section-head">
        <span class="section-num" aria-hidden="true">${number}</span>
        <h2 id="${id}">${spans(en, ru)}</h2>
      </div>`;
}

function renderPayNote({ en, ru }, wallets) {
  const crypto = wallets.length === 0
    ? ''
    : ` <a href="#crypto">${spans(en.payNote.crypto, ru.payNote.crypto)}: ${wallets.map((w) => escape(w.coin)).join(' · ')}</a>`;
  return `<p class="pay-note">${ICONS.card}${spans(en.payNote.boosty, ru.payNote.boosty)}${crypto}</p>`;
}

function renderPipoker({ en, ru }, v) {
  const p = en.pipoker;
  const r = ru.pipoker;
  const tags = p.tags.map((tag, i) => `<li>${spans(tag, r.tags[i])}</li>`).join('');
  const features = p.features.map((feature, i) => `<li>${spans(feature, r.features[i])}</li>`).join('');
  return `<article class="card feature" id="pipoker">
        <div class="feature-text">
          <ul class="tags">${tags}</ul>
          <h3>${spans(p.name, r.name)}</h3>
          ${both('p', p.description, r.description, ' class="pitch"')}
          <ul class="checks">${features}</ul>
          <a class="btn btn-blue" href="${escape(p.url)}">${spans(p.cta, r.cta)}${ICONS.arrowOut}</a>
          <p class="repos">${ICONS.github}${spans(p.sourceLabel, r.sourceLabel)} ${p.repos.map((repo, i) => `<a href="${escape(repo.url)}">${spans(repo.name, r.repos[i].name)}</a>`).join(' · ')}</p>
        </div>
        <div class="feature-media" aria-hidden="true">
          <div class="browser">
            <div class="browser-bar"><i></i><i></i><i></i><span class="browser-url">pipoker.app</span></div>
            ${video(v, 'pipoker', PIPOKER_SIZE, { poster: true })}
          </div>
        </div>
      </article>`;
}

function renderModels({ en, ru }, v) {
  const p = en.printables;
  const r = ru.printables;
  const size = { width: MODEL_SIZE, height: MODEL_SIZE };
  const tiles = en.models.map((model, i) => {
    const other = ru.models[i];
    const media = still(v, model.id, size) + (hasVideo(model.id) ? video(v, model.id, size) : '');
    return `
        <a class="model" href="${escape(model.url)}" data-model="${escape(model.id)}">${media}<span class="model-caption"><strong>${spans(model.title, other.title)}</strong>${spans(model.caption, other.caption)}</span></a>`;
  }).join('');
  return `<div class="models">
        <article class="card models-intro">
          <span class="card-icon card-icon-orange" aria-hidden="true">${ICONS.cube}</span>
          <h3>${spans(p.name, r.name)}</h3>
          ${both('p', p.description, r.description, ' class="pitch"')}
          ${both('p', p.hint, r.hint, ' class="hint"')}
          <a class="text-link" href="${escape(p.url)}">${spans(p.cta, r.cta)}${ICONS.arrowOut}</a>
        </article>${tiles}
      </div>`;
}

function renderLinks({ en, ru }) {
  const cards = en.links.map((link, i) => {
    const other = ru.links[i];
    const color = link.id === 'github' ? 'blue' : 'orange';
    return `
        <a class="card link-card" href="${escape(link.url)}">
          <span class="card-icon card-icon-${color}" aria-hidden="true">${ICONS[link.id] ?? ICONS.arrowOut}</span>
          <span class="link-card-body">
            <span class="link-card-title">${spans(link.name, other.name)}</span>
            <span class="pitch">${spans(link.description, other.description)}</span>
            <span class="handle">${escape(link.url.replace(/^https:\/\//, ''))}</span>
          </span>
          ${ICONS.arrowOut.replace('class="icon"', 'class="icon link-card-arrow"')}
        </a>`;
  }).join('');
  return `<div class="duo">${cards}
      </div>`;
}

function renderGoals({ en, ru }) {
  return en.goals.map((goal, i) => {
    const [color, svg] = GOAL_ICONS[i % GOAL_ICONS.length];
    return `
        <li class="goal">
          <span class="goal-icon goal-${color}" aria-hidden="true">${svg}</span>
          <span class="goal-text">${spans(goal.title, ru.goals[i].title)}</span>
          <span class="goal-tag">${spans(goal.tag, ru.goals[i].tag)}</span>
        </li>`;
  }).join('');
}

function renderAddress(address) {
  const a = escape(address);
  return `<code class="address"><b>${a.slice(0, 4)}</b>${a.slice(4, -4)}<b>${a.slice(-4)}</b></code>`;
}

function renderWallet(wallet, { en, ru }, v) {
  // an unbreakable hyphen keeps "TRC-20" in one piece inside the warning
  const values = { coin: wallet.coin, network: wallet.network.replace(/-/g, '‑') };
  const coinId = `wallet-${escape(wallet.id)}-coin`;
  const badge = COIN_BADGES[wallet.coin] ?? escape(wallet.coin.slice(0, 1));
  const network = wallet.network === wallet.coin ? '' : `<span class="network">${escape(wallet.network)}</span>`;
  return `
          <section class="wallet" data-wallet="${escape(wallet.id)}">
            <div class="wallet-head">
              <span class="coin coin-${escape(wallet.coin.toLowerCase())}" aria-hidden="true">${badge}</span>
              <h4 id="${coinId}">${escape(wallet.coin)}</h4>
              ${network}
            </div>
            <img class="qr" src="${v(`/qr/${wallet.id}.png`)}" alt="${escape(wallet.coin)} QR" width="200" height="200" loading="lazy">
            ${renderAddress(wallet.address)}
            <button class="copy" type="button" data-address="${escape(wallet.address)}" aria-describedby="${coinId}">${ICONS.copy}${ICONS.check}${spans(en.copy, ru.copy, ' class="label"')}${spans(en.copied, ru.copied, ' class="done"')}</button>
            <span class="sr-only" role="status"></span>
            ${both('p', fill(en.networkWarning, values), fill(ru.networkWarning, values), ' class="warning"')}
          </section>`;
}

function renderCrypto(wallets, text, v) {
  if (wallets.length === 0) return '';
  return `
      <div class="crypto" id="crypto">
        <div class="crypto-head">
          <h3>${spans(text.en.title, text.ru.title)}</h3>
          ${both('p', text.en.text, text.ru.text)}
          ${both('p', text.en.checkHint, text.ru.checkHint, ' class="check-hint"')}
        </div>
        <div class="wallets">${wallets.map((wallet) => renderWallet(wallet, text, v)).join('')}
        </div>
      </div>`;
}

function renderFooter({ en, ru }) {
  const links = [
    ['PiPoker', en.pipoker.url],
    ['Printables', en.printables.url],
    ...en.links.map((link) => [link.name, link.url]),
  ];
  return `<footer class="footer">
    <div class="footer-inner">
      ${ICONS.heart.replace('class="icon"', 'class="footer-heart"')}
      ${both('p', en.thanks, ru.thanks, ' class="thanks"')}
      <ul class="footer-links">${links.map(([name, url]) => `<li><a href="${escape(url)}">${escape(name)}</a></li>`).join('')}</ul>
      ${both('p', en.colophon, ru.colophon, ' class="colophon"')}
    </div>
  </footer>`;
}

function renderPage(content, wallets, v) {
  const { en, ru } = content;
  const crafts = en.crafts.map((craft, i) => `<li>${CRAFT_ICONS[i % CRAFT_ICONS.length]}${spans(craft, ru.crafts[i])}</li>`).join('');

  return `<!doctype html>
<html lang="en" data-lang="en" data-title-en="${escape(en.title)}" data-title-ru="${escape(ru.title)}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta http-equiv="Content-Security-Policy" content="${CSP}">
  <meta name="color-scheme" content="light dark">
  <meta name="theme-color" media="(prefers-color-scheme: light)" content="#f6f3ee">
  <meta name="theme-color" media="(prefers-color-scheme: dark)" content="#0f1013">
  <title>${escape(en.title)}</title>
  <meta name="description" lang="en" content="${escape(en.description)}">
  <meta name="description" lang="ru" content="${escape(ru.description)}">
  <link rel="canonical" href="${SITE_URL}/">
  <link rel="icon" href="${v('/favicon.svg')}" type="image/svg+xml">
  <link rel="stylesheet" href="${v('/style.css')}">
  <script src="${v('/lang.js')}"></script>
  <script src="${v('/copy.js')}" defer></script>
  <script src="${v('/media.js')}" defer></script>
</head>
<body>
  <a class="skip" href="#main">${spans(en.skip, ru.skip)}</a>

  <div class="topbar">
    <div class="topbar-inner">
      <a class="brand" href="#main">
        <span class="brand-mark" aria-hidden="true">LD</span>
        <span class="brand-name">${spans(en.name, ru.name)}</span>
      </a>
      <nav class="nav" aria-labelledby="nav-label">
        <span id="nav-label" class="sr-only">${spans(en.nav.label, ru.nav.label)}</span>
        <a href="#projects">${spans(en.nav.projects, ru.nav.projects)}</a>
        <a href="#goals">${spans(en.nav.goals, ru.nav.goals)}</a>
        <a href="#support">${spans(en.nav.support, ru.nav.support)}</a>
      </nav>
      <div class="lang-switcher" role="group" aria-label="Language / Язык">
        <button class="lang-switch" type="button" data-set-lang="ru" aria-pressed="false">RU</button>
        <button class="lang-switch" type="button" data-set-lang="en" aria-pressed="true">EN</button>
      </div>
      <a class="btn btn-primary btn-small" href="#support">${ICONS.heart}${spans(en.supportButton, ru.supportButton)}</a>
    </div>
  </div>

  <main id="main">
    <header class="hero">
      <div class="hero-inner">
        <div class="hero-main">
          <p class="eyebrow"><span class="dot" aria-hidden="true"></span>${spans(en.role, ru.role)}</p>
          ${both('h1', en.name, ru.name)}
          <ul class="crafts">${crafts}</ul>
        </div>
        <div class="hero-side">
          <p class="intro" lang="en">${escape(en.intro)} <strong>${escape(en.introKey)}</strong></p><p class="intro" lang="ru">${escape(ru.intro)} <strong>${escape(ru.introKey)}</strong></p>
          <div class="actions">
            <a class="btn btn-primary" href="#support">${ICONS.heart}${spans(en.supportButton, ru.supportButton)}</a>
            <a class="btn btn-ghost" href="#projects">${spans(en.workButton, ru.workButton)}${ICONS.arrowDown}</a>
          </div>
          ${renderPayNote(content, wallets)}
        </div>
      </div>
    </header>

    <section id="projects" class="section" aria-labelledby="projects-title">
      ${sectionHead('01', 'projects-title', en.projectsTitle, ru.projectsTitle)}
      ${renderPipoker(content, v)}
      ${renderModels(content, v)}
      ${renderLinks(content)}
    </section>

    <section id="goals" class="section" aria-labelledby="goals-title">
      ${sectionHead('02', 'goals-title', en.goalsTitle, ru.goalsTitle)}
      <ul class="goals">${renderGoals(content)}
      </ul>
    </section>

    <section id="support" class="section" aria-labelledby="support-title">
      ${sectionHead('03', 'support-title', en.supportTitle, ru.supportTitle)}

      <article class="boosty" id="boosty">
        <div class="boosty-text">
          <h3>${spans(en.boosty.title, ru.boosty.title)}</h3>
          ${both('p', en.boosty.text, ru.boosty.text)}
          <ul class="boosty-chips">${en.boosty.chips.map((chip, i) => `<li>${spans(chip, ru.boosty.chips[i])}</li>`).join('')}</ul>
          <a class="btn btn-dark btn-large" href="${escape(en.boosty.url)}">${ICONS.heart}${spans(en.boosty.button, ru.boosty.button)}</a>
          ${both('p', en.boosty.note, ru.boosty.note, ' class="boosty-note"')}
        </div>
        ${BOOSTY_ART}
      </article>
${renderCrypto(wallets, { en: en.crypto, ru: ru.crypto }, v)}
    </section>
  </main>

  ${renderFooter(content)}
</body>
</html>
`;
}

export async function build({ content, wallets, outDir }) {
  checkWallets(wallets);
  checkMedia(content.en.models);

  await rm(outDir, { recursive: true, force: true });
  await mkdir(outDir, { recursive: true });
  if (wallets.length > 0) await mkdir(join(outDir, 'qr'), { recursive: true });

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
  await cp(MEDIA, join(outDir, 'media'), { recursive: true });

  const v = await versionsOf(outDir);
  await writeFile(join(outDir, 'index.html'), renderPage(content, wallets, v));
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

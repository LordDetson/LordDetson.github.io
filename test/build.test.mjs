import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, readdir, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { test } from 'node:test';

import { ROOT, SAMPLE_WALLETS, buildSite, exists, loadContent } from './helpers.mjs';

function escape(text) {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function texts(value, key = '') {
  if (typeof value === 'string') return ['lang', 'id', 'url'].includes(key) ? [] : [value];
  if (Array.isArray(value)) return value.flatMap((item) => texts(item));
  if (value && typeof value === 'object') return Object.entries(value).flatMap(([k, v]) => texts(v, k));
  return [];
}

function tags(html, name) {
  return [...html.matchAll(new RegExp(`<${name}\\b[^>]*>`, 'g'))].map(([tag]) => tag);
}

function attr(tag, name) {
  return tag.match(new RegExp(`\\s${name}="([^"]*)"`))?.[1];
}

test('the site is a single page without a separate Russian copy', async () => {
  const site = await buildSite([]);
  assert.match(site.html, /<html lang="en" data-lang="en"/);
  assert.equal(await exists(join(site.outDir, 'ru')), false);
});

test('the page carries every text in both languages', async () => {
  const { en, ru } = await loadContent();
  const site = await buildSite(SAMPLE_WALLETS);
  const missing = [...texts(en), ...texts(ru)]
    .filter((text) => !text.includes('{'))
    .filter((text) => !site.html.includes(escape(text)));
  assert.deepEqual(missing, []);
});

test('every English text has its Russian pair', async () => {
  const site = await buildSite(SAMPLE_WALLETS);
  const count = (lang) => site.html.match(new RegExp(` lang="${lang}"`, 'g')).length;
  assert.equal(count('ru'), count('en') - 1); // the <html> element itself is lang="en"
});

test('the page has a RU / EN switch', async () => {
  const site = await buildSite([]);
  assert.match(site.html, /<button class="lang-switch" type="button" data-set-lang="ru"[^>]*>RU<\/button>/);
  assert.match(site.html, /<button class="lang-switch" type="button" data-set-lang="en"[^>]*>EN<\/button>/);
});

test('the language script runs in the head before the page is drawn', async () => {
  const site = await buildSite([]);
  const head = site.html.slice(0, site.html.indexOf('</head>'));
  assert.match(head, /<script src="\/lang\.js\?v=[0-9a-f]{8}"><\/script>/);
  assert.ok(await exists(join(site.outDir, 'lang.js')));
});

test('the page knows the title in both languages', async () => {
  const { en, ru } = await loadContent();
  const site = await buildSite([]);
  assert.ok(site.html.includes(`data-title-en="${escape(en.title)}"`));
  assert.ok(site.html.includes(`data-title-ru="${escape(ru.title)}"`));
  assert.ok(site.html.includes(`<title>${escape(en.title)}</title>`));
});

test('the stylesheet hides the language that is not chosen', async () => {
  const css = await readFile(new URL('assets/style.css', ROOT), 'utf8');
  assert.match(css, /html\[data-lang="en"\] \[lang="ru"\]/);
  assert.match(css, /html\[data-lang="ru"\] \[lang="en"\]/);
});

test('the page has no inline scripts, styles or event handlers', async () => {
  const site = await buildSite(SAMPLE_WALLETS);
  for (const tag of tags(site.html, 'script')) assert.match(tag, /\bsrc="/, tag);
  assert.doesNotMatch(site.html, /<script\b[^>]*>[^<]+<\/script>/);
  assert.doesNotMatch(site.html, /<style\b/);
  assert.doesNotMatch(site.html, /\sstyle="/);
  assert.doesNotMatch(site.html, /\son[a-z]+="/);
});

test('the content security policy is exactly the strict one and allows only own resources', async () => {
  const site = await buildSite([]);
  const csp = site.html.match(/http-equiv="Content-Security-Policy" content="([^"]+)"/)[1];
  assert.equal(
    csp,
    "default-src 'none'; img-src 'self'; media-src 'self'; style-src 'self'; script-src 'self'; base-uri 'none'; form-action 'none'",
  );
});

test('every script, stylesheet, image and video comes from the site itself', async () => {
  const site = await buildSite(SAMPLE_WALLETS);
  const sources = [
    ...tags(site.html, 'script').map((t) => attr(t, 'src')),
    ...tags(site.html, 'link').filter((t) => /rel="(stylesheet|icon)"/.test(t)).map((t) => attr(t, 'href')),
    ...tags(site.html, 'img').map((t) => attr(t, 'src')),
    ...tags(site.html, 'video').map((t) => attr(t, 'poster')).filter(Boolean),
    ...tags(site.html, 'source').map((t) => attr(t, 'src')),
  ];
  assert.ok(sources.length > 10);
  for (const src of sources) {
    assert.match(src, /^\/[^/]/, src);
    assert.ok(await exists(join(site.outDir, src.split('?')[0])), `missing ${src}`);
  }
});

test('every own file is linked with a version taken from its content', async () => {
  const site = await buildSite(SAMPLE_WALLETS);
  const refs = [
    ...tags(site.html, 'script').map((t) => attr(t, 'src')),
    ...tags(site.html, 'link').filter((t) => /rel="(stylesheet|icon)"/.test(t)).map((t) => attr(t, 'href')),
    ...tags(site.html, 'img').map((t) => attr(t, 'src')),
    ...tags(site.html, 'video').map((t) => attr(t, 'poster')).filter(Boolean),
    ...tags(site.html, 'source').map((t) => attr(t, 'src')),
  ];
  for (const ref of refs) {
    const [path, version] = ref.split('?v=');
    assert.match(version ?? '', /^[0-9a-f]{8}$/, ref);
    const digest = createHash('sha256').update(await readFile(join(site.outDir, path))).digest('hex');
    assert.equal(version, digest.slice(0, 8), ref);
  }
});

test('every image and video has its size and every image has alt text', async () => {
  const site = await buildSite(SAMPLE_WALLETS);
  for (const tag of [...tags(site.html, 'img'), ...tags(site.html, 'video')]) {
    assert.match(tag, /\swidth="\d+"/, tag);
    assert.match(tag, /\sheight="\d+"/, tag);
  }
  for (const tag of tags(site.html, 'img')) assert.match(tag, /\salt="/, tag);
});

test('the top bar shows the LD monogram and a favicon', async () => {
  const site = await buildSite([]);
  assert.match(site.html, /<span class="brand-mark" aria-hidden="true">LD<\/span>/);
  assert.match(site.html, /<link rel="icon" href="\/favicon\.svg\?v=[0-9a-f]{8}" type="image\/svg\+xml">/);
});

test('both support buttons above the fold lead to the "How to support" section', async () => {
  const site = await buildSite([]);
  const header = site.html.slice(0, site.html.indexOf('id="projects"'));
  const toSupport = header.match(/<a class="btn btn-primary[^"]*" href="#support">/g) ?? [];
  assert.equal(toSupport.length, 2);
  assert.match(site.html, /<section id="support"/);
});

test('the short key phrase of the intro is in bold', async () => {
  const { en, ru } = await loadContent();
  const site = await buildSite([]);
  assert.ok(site.html.includes(`<strong>${escape(en.introKey)}</strong>`));
  assert.ok(site.html.includes(`<strong>${escape(ru.introKey)}</strong>`));
});

test('the PiPoker card shows the demo video and opens pipoker.app', async () => {
  const site = await buildSite([]);
  const card = site.html.match(/<article class="card feature" id="pipoker">[\s\S]*?<\/article>/)[0];
  assert.match(card, /href="https:\/\/pipoker\.app"/);
  assert.match(card, /<video [^>]*poster="\/media\/pipoker\.webp\?v=[0-9a-f]{8}"/);
  assert.match(card, /<source src="\/media\/pipoker\.mp4\?v=[0-9a-f]{8}" type="video\/mp4">/);
});

test('every model tile opens its Printables page and shows its picture', async () => {
  const { en } = await loadContent();
  const site = await buildSite([]);
  const tiles = [...site.html.matchAll(/<a class="model" href="([^"]+)" data-model="([^"]+)">([\s\S]*?)<\/a>/g)];
  assert.deepEqual(tiles.map(([, , id]) => id), en.models.map((m) => m.id));
  for (const [, href, id, body] of tiles) {
    assert.equal(href, en.models.find((m) => m.id === id).url);
    // the still picture loads lazily, so tiles far below the fold cost nothing on the first screen
    assert.match(body, new RegExp(`<img class="media still" src="/media/${id}\\.webp\\?v=[0-9a-f]{8}" alt="" width="\\d+" height="\\d+" loading="lazy"`), id);
  }
});

test('videos play silently in a loop and only start from the script', async () => {
  const site = await buildSite([]);
  const videos = tags(site.html, 'video');
  assert.ok(videos.length >= 2);
  for (const video of videos) {
    for (const flag of ['muted', 'loop', 'playsinline', 'data-autoplay']) assert.match(video, new RegExp(`\\s${flag}[\\s>]`), video);
    assert.match(video, /\spreload="none"/, video);
    assert.doesNotMatch(video, /\sautoplay[\s>]/, video);
  }
  // only the PiPoker video near the top has a poster; model tiles show their lazy still picture instead
  assert.deepEqual(videos.filter((v) => /\sposter="/.test(v)).length, 1);
  assert.match(site.html, /<script src="\/media\.js\?v=[0-9a-f]{8}" defer><\/script>/);
});

test('pictures and videos stay within the weight budget', async () => {
  const site = await buildSite([]);
  const files = await readdir(join(site.outDir, 'media'));
  const size = async (ext) => {
    let total = 0;
    for (const file of files.filter((f) => f.endsWith(ext))) total += (await stat(join(site.outDir, 'media', file))).size;
    return total;
  };
  assert.ok((await size('.webp')) <= 600 * 1024, 'pictures over 600 KB');
  assert.ok((await size('.mp4')) <= 6 * 1024 * 1024, 'videos over 6 MB');
});

test('the page links every project', async () => {
  const { en } = await loadContent();
  const site = await buildSite([]);
  const urls = [en.pipoker.url, en.printables.url, ...en.models.map((m) => m.url), ...en.links.map((l) => l.url)];
  for (const url of urls) assert.ok(site.html.includes(`href="${url}"`), url);
});

test('Boosty comes before the crypto wallets', async () => {
  const site = await buildSite(SAMPLE_WALLETS);
  const boosty = site.html.indexOf('id="boosty"');
  const crypto = site.html.indexOf('id="crypto"');
  assert.ok(boosty > 0, 'Boosty section');
  assert.ok(crypto > boosty, 'crypto section after Boosty');
});

test('without wallets there is no crypto section and no link to it', async () => {
  const site = await buildSite([]);
  assert.doesNotMatch(site.html, /id="crypto"/);
  assert.doesNotMatch(site.html, /href="#crypto"/);
});

test('with wallets the payment note names the coins and links to them', async () => {
  const site = await buildSite(SAMPLE_WALLETS);
  const note = site.html.match(/<p class="pay-note">[\s\S]*?<\/p>/)[0];
  assert.match(note, /href="#crypto"/);
  for (const wallet of SAMPLE_WALLETS) assert.ok(note.includes(wallet.coin), wallet.coin);
});

test('the footer says the page has no trackers', async () => {
  const { en } = await loadContent();
  const site = await buildSite([]);
  const footer = site.html.slice(site.html.indexOf('<footer'));
  assert.ok(footer.includes(escape(en.colophon)));
});

// Walks en.json and ru.json together and yields [path, en, ru] for every text shown as a twin.
function pairs(en, ru, path = []) {
  if (typeof en === 'string') return [[path.join('.'), en, ru]];
  if (Array.isArray(en)) return en.flatMap((item, i) => pairs(item, ru[i], [...path, i]));
  return Object.keys(en).flatMap((key) => pairs(en[key], ru[key], [...path, key]));
}

test('every English text sits under lang="en" and its Russian pair under lang="ru"', async () => {
  const { en, ru } = await loadContent();
  const site = await buildSite(SAMPLE_WALLETS);
  const skip = /(^|\.)(id|url|lang)$|^(title|description|introKey)$/;
  const wrong = pairs(en, ru)
    .filter(([path, text]) => !skip.test(path) && !text.includes('{'))
    .filter(([, enText, ruText]) => !site.html.includes(`lang="en">${escape(enText)}`) || !site.html.includes(`lang="ru">${escape(ruText)}`))
    .map(([path]) => path);
  assert.deepEqual(wrong, []);
});

test('the built page never names a country or a city', async () => {
  for (const wallets of [[], SAMPLE_WALLETS]) {
    const site = await buildSite(wallets);
    assert.doesNotMatch(site.html, /Belarus|Беларус|Белорус|Minsk|Минск/i);
  }
});

test('the built page uses no em dash anywhere', async () => {
  const site = await buildSite(SAMPLE_WALLETS);
  assert.doesNotMatch(site.html, /—/);
});

test('the brand link and the section menu have names in the chosen language', async () => {
  const site = await buildSite([]);
  assert.match(site.html, /<a class="brand" href="#main">[\s\S]*?<span class="brand-name">/);
  assert.doesNotMatch(site.html, /aria-label="Sections \/ /);
  const nav = tags(site.html, 'nav')[0];
  const labelId = attr(nav, 'aria-labelledby');
  assert.ok(labelId, 'nav has aria-labelledby');
  assert.match(site.html, new RegExp(`<span id="${labelId}" class="sr-only"><span lang="en">Sections</span><span lang="ru">Разделы</span></span>`));
});

test('every copy button names the coin it copies and has a status line for screen readers', async () => {
  const site = await buildSite(SAMPLE_WALLETS);
  for (const wallet of SAMPLE_WALLETS) {
    const body = site.html.match(new RegExp(`<section class="wallet" data-wallet="${wallet.id}">([\\s\\S]*?)</section>`))[1];
    const button = tags(body, 'button')[0];
    const titleId = attr(button, 'aria-describedby');
    assert.ok(body.includes(`<h4 id="${titleId}">${wallet.coin}</h4>`), wallet.id);
    assert.match(body, /<span class="sr-only" role="status"><\/span>/, wallet.id);
  }
});

test('the PiPoker card links its source code', async () => {
  const { en } = await loadContent();
  const site = await buildSite([]);
  const card = site.html.match(/<article class="card feature" id="pipoker">[\s\S]*?<\/article>/)[0];
  const repos = card.match(/<p class="repos">[\s\S]*?<\/p>/)?.[0] ?? '';
  for (const repo of en.pipoker.repos) assert.ok(repos.includes(`href="${repo.url}"`), repo.url);
});

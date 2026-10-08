import assert from 'node:assert/strict';
import { test } from 'node:test';

import { SAMPLE_WALLETS, buildSite, loadContent } from './helpers.mjs';

test('the English page is at the root and the Russian one under /ru/', async () => {
  const site = await buildSite([]);
  assert.match(site.en, /<html lang="en">/);
  assert.match(site.ru, /<html lang="ru">/);
});

test('each page links to the other language', async () => {
  const site = await buildSite([]);
  assert.match(site.en, /<a class="language" href="\/ru\/" hreflang="ru">/);
  assert.match(site.ru, /<a class="language" href="\/" hreflang="en">/);
});

test('pages have no inline scripts or event handlers', async () => {
  const site = await buildSite(SAMPLE_WALLETS);
  for (const html of [site.en, site.ru]) {
    for (const [tag] of html.matchAll(/<script\b[^>]*>/g)) assert.match(tag, /\bsrc="/, tag);
    assert.doesNotMatch(html, /<script\b[^>]*>[^<]+<\/script>/);
    assert.doesNotMatch(html, /\son[a-z]+="/);
  }
});

test('the page shows the name, the projects and the goals', async () => {
  const { en, ru } = await loadContent();
  const site = await buildSite([]);
  for (const [html, content] of [[site.en, en], [site.ru, ru]]) {
    assert.ok(html.includes(content.name), 'name');
    for (const project of content.projects) assert.ok(html.includes(`href="${project.url}"`), project.id);
    for (const goal of content.goals) assert.ok(html.includes(goal), goal);
  }
});

test('Boosty comes before the crypto wallets', async () => {
  const site = await buildSite(SAMPLE_WALLETS);
  for (const html of [site.en, site.ru]) {
    const boosty = html.indexOf('id="boosty"');
    const crypto = html.indexOf('id="crypto"');
    assert.ok(boosty > 0, 'Boosty section');
    assert.ok(crypto > boosty, 'crypto section after Boosty');
  }
});

test('without wallets there is no crypto section', async () => {
  const site = await buildSite([]);
  assert.doesNotMatch(site.en, /id="crypto"/);
  assert.doesNotMatch(site.ru, /id="crypto"/);
});

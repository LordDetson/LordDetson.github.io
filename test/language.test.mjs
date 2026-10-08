import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { test } from 'node:test';
import vm from 'node:vm';

import { pickLanguage } from '../src/language.mjs';
import { buildSite } from './helpers.mjs';

test('a Russian-speaking browser gets Russian', () => {
  for (const lang of ['ru', 'ru-RU', 'be-BY', 'uk', 'kk-KZ']) {
    assert.equal(pickLanguage({ languages: [lang] }), 'ru', lang);
  }
});

test('any other browser gets English', () => {
  for (const languages of [['en-US'], ['de-DE', 'fr'], ['pl'], []]) {
    assert.equal(pickLanguage({ languages }), 'en', languages.join());
  }
});

test('the first known browser language wins', () => {
  assert.equal(pickLanguage({ languages: ['de', 'ru', 'en'] }), 'ru');
  assert.equal(pickLanguage({ languages: ['en-GB', 'ru'] }), 'en');
});

test('a saved choice beats the browser language', () => {
  assert.equal(pickLanguage({ saved: 'en', languages: ['ru'] }), 'en');
  assert.equal(pickLanguage({ saved: 'ru', languages: ['en'] }), 'ru');
});

test('?lang= in the link beats a saved choice', () => {
  assert.equal(pickLanguage({ query: '?lang=ru', saved: 'en', languages: ['en'] }), 'ru');
  assert.equal(pickLanguage({ query: '?lang=en', saved: 'ru', languages: ['ru'] }), 'en');
});

test('unknown values are ignored', () => {
  assert.equal(pickLanguage({ query: '?lang=de', saved: 'fr', languages: ['ru'] }), 'ru');
});

// Runs the built lang.js against a minimal fake browser.
async function runLangScript({ languages, saved = null, search = '' }) {
  const replaced = [];
  const site = await buildSite([]);
  const code = await readFile(join(site.outDir, 'lang.js'), 'utf8');
  const root = { dataset: { lang: 'en', titleEn: 'Support', titleRu: 'Поддержать' }, lang: 'en' };
  const store = new Map(saved ? [['lang', saved]] : []);
  const listeners = {};
  const buttons = ['ru', 'en'].map((lang) => ({
    dataset: { setLang: lang },
    attributes: {},
    setAttribute(name, value) {
      this.attributes[name] = value;
    },
    addEventListener(type, fn) {
      this.click = fn;
    },
  }));
  const document = {
    documentElement: root,
    title: 'Support',
    readyState: 'loading',
    querySelectorAll: () => buttons,
    addEventListener: (type, fn) => (listeners[type] = fn),
  };
  const context = {
    document,
    navigator: { languages },
    location: { search, pathname: '/', hash: '' },
    history: { replaceState: (state, title, url) => replaced.push(String(url)) },
    localStorage: { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, v) },
  };
  vm.runInNewContext(code, context);
  listeners.DOMContentLoaded?.();
  return { root, document, store, buttons, replaced };
}

test('the built script switches a Russian browser to Russian before the page is drawn', async () => {
  const page = await runLangScript({ languages: ['ru-RU'] });
  assert.equal(page.root.dataset.lang, 'ru');
  assert.equal(page.root.lang, 'ru');
  assert.equal(page.document.title, 'Поддержать');
});

test('the switch changes the language and remembers it', async () => {
  const page = await runLangScript({ languages: ['ru-RU'] });
  page.buttons.find((b) => b.dataset.setLang === 'en').click();
  assert.equal(page.root.dataset.lang, 'en');
  assert.equal(page.document.title, 'Support');
  assert.equal(page.store.get('lang'), 'en');
  assert.equal(page.buttons.find((b) => b.dataset.setLang === 'en').attributes['aria-pressed'], 'true');
  assert.equal(page.buttons.find((b) => b.dataset.setLang === 'ru').attributes['aria-pressed'], 'false');
});

test('switching the language rewrites ?lang= in the address, so a reload or a shared link keeps it', async () => {
  const page = await runLangScript({ languages: ['en'], search: '?lang=ru' });
  assert.equal(page.root.dataset.lang, 'ru');
  page.buttons.find((b) => b.dataset.setLang === 'en').click();
  assert.deepEqual(page.replaced, ['/?lang=en']);
});

test('without ?lang= in the address the switch leaves the address alone', async () => {
  const page = await runLangScript({ languages: ['en'] });
  page.buttons.find((b) => b.dataset.setLang === 'ru').click();
  assert.deepEqual(page.replaced, []);
});

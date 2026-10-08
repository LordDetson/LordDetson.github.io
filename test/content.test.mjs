import assert from 'node:assert/strict';
import { test } from 'node:test';

import { loadContent } from './helpers.mjs';

function shape(value) {
  if (Array.isArray(value)) return value.map(shape);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, shape(value[key])]));
  }
  return typeof value;
}

function strings(value) {
  if (typeof value === 'string') return [value];
  if (value && typeof value === 'object') return Object.values(value).flatMap(strings);
  return [];
}

test('Russian and English texts have the same structure', async () => {
  const { en, ru } = await loadContent();
  assert.deepEqual(shape(ru), shape(en));
});

test('texts use no em dash', async () => {
  const { en, ru } = await loadContent();
  const withDash = [...strings(en), ...strings(ru)].filter((s) => s.includes('—'));
  assert.deepEqual(withDash, []);
});

test('every text is filled in', async () => {
  const { en, ru } = await loadContent();
  const empty = [...strings(en), ...strings(ru)].filter((s) => s.trim() === '');
  assert.deepEqual(empty, []);
});

test('the page names the author without a country', async () => {
  const { en, ru } = await loadContent();
  assert.equal(en.name, 'Dmitry Babanin');
  assert.equal(ru.name, 'Дмитрий Бабанин');
  for (const text of [...strings(en), ...strings(ru)]) {
    assert.doesNotMatch(text, /Belarus|Беларус|Белорус|Minsk|Минск/i);
  }
});

test('PiPoker points to pipoker.app and lists three facts', async () => {
  const { en, ru } = await loadContent();
  assert.equal(en.pipoker.url, 'https://pipoker.app');
  assert.equal(ru.pipoker.url, 'https://pipoker.app');
  assert.equal(en.pipoker.features.length, 3);
});

test('the showcase has five models, each with its own Printables page', async () => {
  const { en, ru } = await loadContent();
  assert.equal(en.models.length, 5);
  assert.deepEqual(ru.models.map((m) => m.id), en.models.map((m) => m.id));
  assert.equal(new Set(en.models.map((m) => m.id)).size, 5);
  for (const [i, model] of en.models.entries()) {
    assert.match(model.url, /^https:\/\/www\.printables\.com\/model\/\d+-/, model.id);
    assert.equal(ru.models[i].url, model.url, model.id);
  }
});

test('GitHub and Boosty news are the link cards', async () => {
  const { en } = await loadContent();
  assert.deepEqual(en.links.map((l) => l.id), ['github', 'boosty']);
  assert.deepEqual(en.links.map((l) => l.url), ['https://github.com/LordDetson', 'https://boosty.to/detson']);
});

test('there are four goals, each with a title and a tag', async () => {
  const { en, ru } = await loadContent();
  for (const content of [en, ru]) {
    assert.equal(content.goals.length, 4);
    for (const goal of content.goals) assert.deepEqual(Object.keys(goal).sort(), ['tag', 'title']);
  }
});

test('Boosty points to the author page and names three ways to pay', async () => {
  const { en, ru } = await loadContent();
  assert.equal(en.boosty.url, 'https://boosty.to/detson');
  assert.equal(ru.boosty.url, 'https://boosty.to/detson');
  assert.equal(en.boosty.chips.length, 3);
});

test('short prefixes and numbers stay with their word at the end of a line', async () => {
  const { en, ru } = await loadContent();
  // "3D-" and "one-" must not hang alone, and "18650" must not drop to a line of its own
  const breakable = [...strings(en), ...strings(ru)].filter((s) => /\b3D-|\bone-time|[a-zа-я] 18650/i.test(s));
  assert.deepEqual(breakable, []);
});

test('PiPoker lists its three repositories on GitHub', async () => {
  const { en, ru } = await loadContent();
  const urls = [
    'https://github.com/LordDetson/pipoker-app',
    'https://github.com/LordDetson/pipoker-web',
    'https://github.com/LordDetson/pipoker-docker-config',
  ];
  assert.deepEqual(en.pipoker.repos.map((r) => r.url), urls);
  assert.deepEqual(ru.pipoker.repos.map((r) => r.url), urls);
  assert.deepEqual(en.pipoker.repos.map((r) => r.name), ['Backend', 'Frontend', 'Docker']);
});

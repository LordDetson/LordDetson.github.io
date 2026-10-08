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
    assert.doesNotMatch(text, /Belarus|Беларус/i);
  }
});

test('the projects are PiPoker, Printables, GitHub and Boosty, all over https', async () => {
  const { en } = await loadContent();
  assert.deepEqual(en.projects.map((p) => p.id), ['pipoker', 'printables', 'github', 'boosty']);
  for (const project of en.projects) assert.match(project.url, /^https:\/\//);
});

test('there are four goals for the money', async () => {
  const { en, ru } = await loadContent();
  assert.equal(en.goals.length, 4);
  assert.equal(ru.goals.length, 4);
});

test('Boosty points to the author page', async () => {
  const { en, ru } = await loadContent();
  assert.equal(en.boosty.url, 'https://boosty.to/detson');
  assert.equal(ru.boosty.url, 'https://boosty.to/detson');
});

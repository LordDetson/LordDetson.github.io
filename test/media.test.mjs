import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { test } from 'node:test';
import vm from 'node:vm';

import { ROOT } from './helpers.mjs';

// Runs assets/media.js against a fake browser with two videos.
async function runMediaScript({ reducedMotion = false, observer = true } = {}) {
  const code = await readFile(new URL('assets/media.js', ROOT), 'utf8');
  const videos = [0, 1].map((i) => ({
    id: i,
    played: 0,
    paused: 0,
    play() {
      this.played++;
      return Promise.resolve();
    },
    pause() {
      this.paused++;
    },
    addEventListener() {},
    classList: { add() {} },
  }));
  let callback = null;
  const observed = [];
  const context = {
    document: { querySelectorAll: (selector) => (selector === 'video[data-autoplay]' ? videos : []) },
    matchMedia: (query) => ({ matches: query === '(prefers-reduced-motion: reduce)' && reducedMotion, addEventListener() {} }),
  };
  if (observer) {
    context.IntersectionObserver = class {
      constructor(fn) {
        callback = fn;
      }
      observe(target) {
        observed.push(target);
      }
    };
  }
  vm.runInNewContext(code, context);
  const scroll = (entries) => callback(entries.map(([target, isIntersecting]) => ({ target, isIntersecting })));
  return { videos, observed, scroll };
}

test('a video starts when it comes into view and pauses when it leaves', async () => {
  const page = await runMediaScript();
  assert.equal(page.observed.length, 2);
  page.scroll([[page.videos[0], true], [page.videos[1], false]]);
  assert.equal(page.videos[0].played, 1);
  assert.equal(page.videos[1].played, 0);
  page.scroll([[page.videos[0], false]]);
  assert.equal(page.videos[0].paused, 1);
});

test('with reduced motion no video plays, the poster stays', async () => {
  const page = await runMediaScript({ reducedMotion: true });
  assert.equal(page.observed.length, 0);
  assert.deepEqual(page.videos.map((v) => v.played), [0, 0]);
});

test('without IntersectionObserver the videos just play', async () => {
  const page = await runMediaScript({ observer: false });
  assert.deepEqual(page.videos.map((v) => v.played), [1, 1]);
});

test('a blocked autoplay does not throw', async () => {
  const code = await readFile(new URL('assets/media.js', ROOT), 'utf8');
  const video = { play: () => Promise.reject(new Error('NotAllowedError')), pause() {}, addEventListener() {}, classList: { add() {} } };
  let callback;
  const context = {
    document: { querySelectorAll: () => [video] },
    matchMedia: () => ({ matches: false, addEventListener() {} }),
    IntersectionObserver: class {
      constructor(fn) {
        callback = fn;
      }
      observe() {}
    },
  };
  vm.runInNewContext(code, context);
  callback([{ target: video, isIntersecting: true }]);
  await new Promise((resolve) => setImmediate(resolve));
});

test('a video waits until it is really on screen, without a head start', async () => {
  const code = await readFile(new URL('assets/media.js', ROOT), 'utf8');
  let options = 'not called';
  const context = {
    document: { querySelectorAll: () => [{ play: () => Promise.resolve(), pause() {}, addEventListener() {}, classList: { add() {} } }] },
    matchMedia: () => ({ matches: false, addEventListener() {} }),
    IntersectionObserver: class {
      constructor(fn, opts) {
        options = opts;
      }
      observe() {}
    },
  };
  vm.runInNewContext(code, context);
  assert.ok(options === undefined || !options.rootMargin || /^0(px)?( 0(px)?)*$/.test(options.rootMargin), JSON.stringify(options));
});

test('switching reduced motion on stops every video', async () => {
  const code = await readFile(new URL('assets/media.js', ROOT), 'utf8');
  const videos = [0, 1].map(() => ({ paused: 0, play: () => Promise.resolve(), pause() { this.paused++; }, addEventListener() {}, classList: { add() {} } }));
  let onChange;
  const query = { matches: false, addEventListener: (type, fn) => (onChange = fn) };
  const context = {
    document: { querySelectorAll: () => videos },
    matchMedia: () => query,
    IntersectionObserver: class {
      observe() {}
    },
  };
  vm.runInNewContext(code, context);
  query.matches = true;
  onChange({ matches: true });
  assert.deepEqual(videos.map((v) => v.paused), [1, 1]);
});

test('a video shows itself over the still picture only once it really plays', async () => {
  const code = await readFile(new URL('assets/media.js', ROOT), 'utf8');
  const listeners = {};
  const classes = new Set();
  const video = { play: () => Promise.resolve(), pause() {}, addEventListener: (type, fn) => (listeners[type] = fn), classList: { add: (c) => classes.add(c) } };
  const context = {
    document: { querySelectorAll: () => [video] },
    matchMedia: () => ({ matches: false, addEventListener() {} }),
    IntersectionObserver: class {
      observe() {}
    },
  };
  vm.runInNewContext(code, context);
  assert.ok(!classes.has('playing'));
  listeners.playing();
  assert.ok(classes.has('playing'));
});

test('no media file carries a location or other personal metadata', async () => {
  const dir = new URL('assets/media/', ROOT);
  const files = await readdir(dir);
  for (const file of files) {
    const bytes = await readFile(new URL(file, dir));
    const text = bytes.toString('latin1');
    if (file.endsWith('.mp4')) {
      assert.ok(!text.includes('loci') && !text.includes('©xyz'), `${file} has a location`);
    }
    if (file.endsWith('.webp')) {
      for (const chunk of ['EXIF', 'XMP ']) assert.ok(!text.includes(chunk), `${file} has ${chunk}`);
    }
  }
});

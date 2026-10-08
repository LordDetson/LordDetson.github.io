// Chooses the page language: ?lang= in the link, then the saved choice, then the browser languages.
// Self-contained on purpose: the build copies its source into lang.js for the browser.
export function pickLanguage({ query = '', saved = null, languages = [] }) {
  const supported = ['en', 'ru'];
  const russianSpeaking = ['ru', 'be', 'uk', 'kk'];

  const fromQuery = /[?&]lang=([a-z]+)(?:&|$)/.exec(query);
  if (fromQuery && supported.includes(fromQuery[1])) return fromQuery[1];
  if (supported.includes(saved)) return saved;

  for (const language of languages) {
    const primary = String(language).toLowerCase().split('-')[0];
    if (primary === 'en') return 'en';
    if (russianSpeaking.includes(primary)) return 'ru';
  }
  return 'en';
}

export function langScript() {
  return `const pickLanguage = ${pickLanguage.toString()};

(function () {
  const root = document.documentElement;

  function apply(lang) {
    root.dataset.lang = lang;
    root.lang = lang;
    document.title = lang === 'ru' ? root.dataset.titleRu : root.dataset.titleEn;
    document.querySelectorAll('[data-set-lang]').forEach((button) => {
      button.setAttribute('aria-pressed', String(button.dataset.setLang === lang));
    });
  }

  let saved = null;
  try {
    saved = localStorage.getItem('lang');
  } catch (e) {
    // storage is blocked: fall back to the browser language
  }
  apply(pickLanguage({
    query: location.search,
    saved: saved,
    languages: navigator.languages || [navigator.language],
  }));

  function bind() {
    document.querySelectorAll('[data-set-lang]').forEach((button) => {
      button.addEventListener('click', () => {
        apply(button.dataset.setLang);
        // ?lang= wins over the saved choice, so keep it in step with the switch
        if (/[?&]lang=/.test(location.search)) {
          try {
            history.replaceState(null, '', location.pathname + '?lang=' + button.dataset.setLang + location.hash);
          } catch (e) {
            // the address just stays as it was
          }
        }
        try {
          localStorage.setItem('lang', button.dataset.setLang);
        } catch (e) {
          // the choice just isn't remembered
        }
      });
    });
    apply(root.dataset.lang);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bind);
  else bind();
})();
`;
}

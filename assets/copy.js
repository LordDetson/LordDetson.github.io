// Copies a wallet address and tells screen readers what happened, in the page language.
(function () {
  const MESSAGES = {
    en: { copied: 'Address copied', selected: 'Address selected, press Ctrl+C to copy' },
    ru: { copied: 'Адрес скопирован', selected: 'Адрес выделен, нажмите Ctrl+C, чтобы скопировать' },
  };

  function say(status, key) {
    const messages = MESSAGES[document.documentElement.lang] || MESSAGES.en;
    if (status) status.textContent = messages[key];
  }

  document.querySelectorAll('button.copy').forEach((button) => {
    button.addEventListener('click', async () => {
      const wallet = button.closest('.wallet');
      const status = wallet.querySelector('[role="status"]');
      try {
        if (!navigator.clipboard) throw new Error('no clipboard');
        await navigator.clipboard.writeText(button.dataset.address);
        button.classList.add('copied');
        say(status, 'copied');
        setTimeout(() => button.classList.remove('copied'), 2000);
      } catch (e) {
        window.getSelection().selectAllChildren(wallet.querySelector('.address'));
        say(status, 'selected');
      }
    });
  });
})();

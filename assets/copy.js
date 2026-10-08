document.querySelectorAll('button.copy').forEach((button) => {
  button.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(button.dataset.address);
      button.classList.add('copied');
      setTimeout(() => button.classList.remove('copied'), 2000);
    } catch {
      const address = button.parentElement.querySelector('.address');
      window.getSelection().selectAllChildren(address);
    }
  });
});

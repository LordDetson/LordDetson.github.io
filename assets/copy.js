document.querySelectorAll('button.copy').forEach((button) => {
  const label = button.textContent;
  button.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(button.dataset.address);
      button.textContent = button.dataset.copied;
      setTimeout(() => {
        button.textContent = label;
      }, 2000);
    } catch {
      const address = button.parentElement.querySelector('.address');
      window.getSelection().selectAllChildren(address);
    }
  });
});

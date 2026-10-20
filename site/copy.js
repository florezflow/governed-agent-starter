// Copy buttons for the prompt examples. Humans maintain this file; the agent can't change .js files.
document.querySelectorAll('.copy').forEach((button) => {
  button.addEventListener('click', async () => {
    const text = button.previousElementSibling.textContent;
    try {
      await navigator.clipboard.writeText(text);
      button.textContent = 'copied';
    } catch {
      button.textContent = 'select and copy';
    }
    setTimeout(() => { button.textContent = 'copy'; }, 1600);
  });
});

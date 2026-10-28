const drop = document.querySelector('.drop');
if (drop) {
  drop.addEventListener('dragover', (e) => {
    e.preventDefault();
    drop.classList.add('over');
  });
  drop.addEventListener('dragleave', () => drop.classList.remove('over'));
  drop.addEventListener('drop', (e) => {
    e.preventDefault();
    drop.classList.remove('over');
    const file = e.dataTransfer.files[0];
    if (file) drop.textContent = file.name;
  });
}

const modal = document.querySelector('.modal');
document.querySelector('.request')?.addEventListener('submit', (e) => {
  e.preventDefault();
  modal.hidden = false;
});
modal?.querySelector('.close').addEventListener('click', () => (modal.hidden = true));
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && modal) modal.hidden = true;
});

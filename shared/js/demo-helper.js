export function showLoading(container, text = '加载中…') {
  const mask = document.createElement('div');
  mask.className = 'loading-mask';
  mask.textContent = text;
  container.appendChild(mask);
  return () => mask.remove();
}

export function showError(container, message) {
  const mask = document.createElement('div');
  mask.className = 'loading-mask';
  mask.textContent = `加载失败：${message}`;
  mask.style.color = '#ff9b9b';
  container.appendChild(mask);
  setTimeout(() => mask.remove(), 4000);
}
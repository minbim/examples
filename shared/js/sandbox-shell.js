import { demos } from './registry.js';
import { sourceUrl } from './config.js';
import { showLoading, showError } from './demo-helper.js';

const viewerEl = document.getElementById('viewer');
const actionsEl = document.getElementById('panel-actions');
const galleryTrack = document.getElementById('gallery-track');
const titleEl = document.getElementById('demo-title');
const descEl = document.getElementById('demo-desc');
const sourceLink = document.getElementById('source-link');

let currentDemo = null;
let currentModule = null;
let activeId = null;

function demoIdFromHash() {
  const id = location.hash.replace(/^#/, '');
  return demos.some((d) => d.id === id) ? id : null;
}

function renderGallery() {
  galleryTrack.innerHTML = '';
  demos.forEach((demo) => {
    const card = document.createElement('div');
    card.className = 'gallery-card';
    card.dataset.id = demo.id;

    const thumbSrc = demo.thumb || null;
    const thumbHtml = thumbSrc
      ? `<div class="gallery-thumb"><img src="${thumbSrc}" alt="${demo.title}" loading="lazy" /></div>`
      : `<div class="gallery-thumb">${demo.id.split('-')[0]}</div>`;

    card.innerHTML = `
      ${thumbHtml}
      <h3>${demo.title}</h3>
      <span>${demo.group}</span>
    `;
    card.addEventListener('click', () => switchDemo(demo.id));
    galleryTrack.appendChild(card);
  });
}

function renderActions(demo) {
  if (!demo.actions?.length) return;
  const group = document.createElement('div');
  group.className = 'action-group';
  group.innerHTML = `<h2>${demo.group}</h2>`;
  demo.actions.forEach(({ label, action }) => {
    const btn = document.createElement('button');
    btn.className = 'action-btn';
    btn.textContent = label;
    btn.addEventListener('click', async () => {
      if (typeof window.demo?.[action] !== 'function') return;
      try {
        await window.demo[action]();
      } catch (err) {
        console.error(err);
        showError(viewerEl, err.message || String(err));
      }
    });
    group.appendChild(btn);
  });
  actionsEl.appendChild(group);
}

function highlightCard(id) {
  galleryTrack.querySelectorAll('.gallery-card').forEach((card) => {
    card.classList.toggle('active', card.dataset.id === id);
  });
}

function destroyCurrent() {
  // destroy 契约：模块导出 destroy 优先，window.demo.destroy 兜底；两者都没有则报错（viewer 必须 dispose，否则 WebGL 上下文会耗尽）
  const destroyFn =
    (typeof currentModule?.destroy === 'function' && currentModule.destroy) ||
    (typeof window.demo?.destroy === 'function' && window.demo.destroy);
  if (destroyFn) {
    try { destroyFn(); } catch (e) { console.warn('destroy 失败', e); }
  } else if (currentDemo) {
    console.error(`[sandbox] 示例 ${currentDemo.id} 未实现 destroy()，viewer 资源未被释放`);
  }
  window.demo = null;
  currentModule = null;
  viewerEl.innerHTML = '';
}

async function switchDemo(id) {
  const demo = demos.find((d) => d.id === id);
  if (!demo || id === activeId) return;
  activeId = id;

  // 1. 销毁上一个示例
  destroyCurrent();

  // 2. 更新界面与地址栏（赋值 hash 会触发 hashchange，由 activeId 守卫挡掉重入）
  titleEl.textContent = demo.title;
  descEl.textContent = demo.desc;
  sourceLink.href = sourceUrl(demo);
  highlightCard(id);
  actionsEl.innerHTML = '';
  const panelEl = document.createElement('div');
  panelEl.className = 'demo-panel';
  actionsEl.appendChild(panelEl); // demo 自绘面板区（mount 第二参），registry 动作按钮排在其后
  renderActions(demo);
  if (location.hash !== '#' + id) location.hash = '#' + id;

  // 3. 加载并挂载新示例
  const removeLoading = showLoading(viewerEl, `加载 ${demo.title}…`);
  try {
    const mod = await demo.module();
    if (typeof mod.mount !== 'function') {
      throw new Error('示例缺少 mount(container) 导出');
    }
    currentModule = mod;
    await mod.mount(viewerEl, panelEl);
    currentDemo = demo;
  } catch (err) {
    activeId = null; // 允许用户重试同一示例
    console.error(err);
    showError(viewerEl, err.message || String(err));
  } finally {
    removeLoading();
  }
}

window.addEventListener('hashchange', () => {
  switchDemo(demoIdFromHash() || demos[0].id);
});

renderGallery();
switchDemo(demoIdFromHash() || demos[0].id);

// 06 · 设计变更与版本对比
// API 以 https://www.minbim.com/docs.html 为准
// 文件分工：main.js=引擎 API 主线；diff-data.js=演示变更数据；change-panel.js=清单抽屉 UI（纯 DOM）
import { assetUrl } from '../../shared/js/paths.js';
import { createStats } from '../../shared/js/ui.js';
import { TYPES, deriveChanges } from './diff-data.js';
import { createChangePanel } from './change-panel.js';

const MODEL_DIR = 'models/multi-discipline/ar';

let container = null;
let viewerOld = null;
let viewerNew = null;
let paneOld = null;
let paneNew = null;
let changePanel = null;

let changes = [];      // 全部变更记录（结构见 diff-data.js）
let statsCells = [];
let drawerBtn = null;

export async function mount(el, panel) {
	container = el;
	container.classList.add('split');
	paneOld = addPane('old', 'V1.0');
	paneNew = addPane('new', 'V2.0');

	viewerOld = createViewer(paneOld);
	viewerNew = createViewer(paneNew);
	window.viewer = viewerNew; // 便于控制台调试

	// 串行加载：全局数据存储为整体替换语义，两个 viewer 并发加载会互相覆盖
	const loaderOld = new MinBIM.Loader(viewerOld, true);
	const modelOld = await loaderOld.load(assetUrl(MODEL_DIR));
	const nodes = loaderOld.getNode();
	const loaderNew = new MinBIM.Loader(viewerNew, true);
	const modelNew = await loaderNew.load(assetUrl(MODEL_DIR));

	({ changes } = deriveChanges(nodes));
	applyColors();
	linkCameras();
	watchPick(viewerOld);
	watchPick(viewerNew);

	buildPanel(panel);
	changePanel = createChangePanel({ onSelect: (c) => selectChange(c) });
	container.parentElement.appendChild(changePanel.el);
	changePanel.update(changes, null);
	changePanel.setOpen(true);
	updateStats();
}

// 分屏视口：两个独立 viewer 容器（引擎按容器 id 初始化）
function addPane(name, label) {
	const pane = document.createElement('div');
	pane.className = 'pane';
	pane.id = `${container.id}-${name}`;
	const tag = document.createElement('span');
	tag.className = 'pane-label';
	tag.textContent = label;
	pane.appendChild(tag);
	container.appendChild(pane);
	return pane;
}

function createViewer(pane) {
	const viewer = new MinBIM.Viewer(pane.id);
	viewer.init({
		config: { assetsDir: assetUrl('assets') },
		background: 'transparent',
		toolbar: false,
		tree: false,          // 结构树读全局存储，双 viewer 只留最后一批，本示例不用
		dynamicCenter: false, // 动态旋转中心不经过 OrbitControls 事件，end 同步会漏
	});
	viewer.renderRequested = true;
	return viewer;
}

// 三色着色：旧版标出将删除（红），新版标出新增（绿）与修改（黄）；该版本不存在的构件隐藏
function applyColors() {
	const byType = [[], [], []];
	changes.forEach((c) => byType[c.type].push(c.guid));
	viewerOld.display.setColor(byType[1], TYPES[1].color);
	viewerOld.display.hide(byType[0]);
	viewerNew.display.setColor(byType[0], TYPES[0].color);
	viewerNew.display.setColor(byType[2], TYPES[2].color);
	viewerNew.display.hide(byType[1]);
}

// 相机联动：交互结束（controls end）才互拷位姿，拖动中不同步避免抖动
function linkCameras() {
	viewerOld.controls.addEventListener('end', () => syncCamera(viewerOld, viewerNew));
	viewerNew.controls.addEventListener('end', () => syncCamera(viewerNew, viewerOld));
}

function syncCamera(from, to) {
	to.camera.position.copy(from.camera.position);
	to.controls.target.copy(from.controls.target);
	to.renderRequested = true;
}

// 变更所在版本的 viewer：新增只在新版，删除只在旧版，修改两侧都有
function viewersOf(change) {
	if (change.type === 0) return [viewerNew];
	if (change.type === 1) return [viewerOld];
	return [viewerOld, viewerNew];
}

// 选中变更（清单 / 模型反查共用）：高亮聚焦所在版本的构件 + 刷新清单
function selectChange(change, fromModel = false) {
	if (fromModel && change) changePanel.reveal(change);
	viewerOld.picker.clearSelection();
	viewerNew.picker.clearSelection();
	if (change) {
		const viewers = viewersOf(change);
		viewers.forEach((v) => v.picker.setSelected([change.guid], true, !fromModel));
		// 新增/删除只存在于一个版本：聚焦结束后把另一侧视角对齐，双屏保持可比
		if (!fromModel && viewers.length === 1) {
			const other = viewers[0] === viewerOld ? viewerNew : viewerOld;
			setTimeout(() => other.restoreView(viewers[0].getView(), 0), 600);
		}
	}
	changePanel.update(changes, change);
}

// 构件反查：点击的构件属于某条变更则清单定位（程序 setSelected 不触发 selected，无回环）
function watchPick(viewer) {
	viewer.picker.addEventListener('selected', (e) => {
		const hit = changes.find((c) => c.guid === String(e.id));
		if (hit) selectChange(hit, true);
	});
	const clear = () => selectChange(null, true);
	viewer.picker.addEventListener('deselect', clear);
	viewer.picker.addEventListener('unselected', clear);
}

function buildPanel(panel) {
	const ops = document.createElement('div');
	ops.className = 'action-group';
	ops.innerHTML = '<h2>版本对比</h2>';
	panel.appendChild(ops);

	const legend = document.createElement('div');
	legend.className = 'legend';
	legend.innerHTML = TYPES.map((t) =>
		`<span><i style="background:${t.color}"></i>${t.name}</span>`
	).join('');
	ops.appendChild(legend);

	drawerBtn = document.createElement('button');
	drawerBtn.className = 'action-btn armed';
	drawerBtn.textContent = '变更清单';
	drawerBtn.addEventListener('click', () => {
		changePanel.setOpen(!changePanel.isOpen());
		drawerBtn.classList.toggle('armed', changePanel.isOpen());
	});
	ops.appendChild(drawerBtn);

	const statsGroup = document.createElement('div');
	statsGroup.className = 'action-group';
	statsGroup.innerHTML = '<h2>变更统计</h2>';
	panel.appendChild(statsGroup);
	statsCells = [];
	const el = createStats([
		{ label: '新增', value: 0 },
		{ label: '删除', value: 0 },
		{ label: '修改', value: 0 },
		{ label: '变更总数', value: 0 }
	], { columns: 2 });
	el.querySelectorAll('.ui-stat b').forEach((b) => statsCells.push(b));
	statsGroup.appendChild(el);
}

function updateStats() {
	const counts = [0, 0, 0];
	changes.forEach((c) => counts[c.type]++);
	statsCells[0].textContent = counts[0];
	statsCells[1].textContent = counts[1];
	statsCells[2].textContent = counts[2];
	statsCells[3].textContent = changes.length;
}

// 沙箱切换示例时调用，必须 dispose viewer，否则 WebGL 上下文耗尽
export function destroy() {
	if (changePanel) changePanel.el.remove();
	if (viewerOld) viewerOld.dispose();
	if (viewerNew) viewerNew.dispose();
	if (container) container.classList.remove('split');
	container = null;
	viewerOld = null;
	viewerNew = null;
	paneOld = null;
	paneNew = null;
	changePanel = null;
	changes = [];
	statsCells = [];
	drawerBtn = null;
	window.viewer = null;
}

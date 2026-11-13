// 09 · 图模联动：两点配准（定位 + 比例）建立平面映射，双向同步视窗区域
// 3D API 以 https://www.minbim.com/docs.html 为准；CAD API 以 minbim-2d《MinBIM CAD 接口文档》为准
import { assetUrl } from '../../shared/js/paths.js';
import { createStats } from '../../shared/js/ui.js';

const MODELS = [
	{ key: 'st', dir: 'models/multi-discipline/st' },
	{ key: 'ar', dir: 'models/multi-discipline/ar' },
];

let container = null;
let viewer3d = null;
let viewerCad = null;
let loader = null;
let loadChain = Promise.resolve();

// 平面映射：图纸X = ox + s·模型x，图纸Y = oy + s·ySign·模型z
// CAD +y 默认对应模型 -z，镜像时改 ySign（面板「翻转 Y」按钮）
let ySign = -1;
let map = null;       // { s, ox, oy }，s = 图纸单位 / 模型单位
let pairs = null;     // 配准点对 { p3d:[{x,z}], p2d:[{x,y}] }，翻转 Y 时重算 map
let regStep = null;   // 配准状态机：'3d-1' → '2d-1' → '3d-2' → '2d-2' → null
let linkOn = false;
let syncing = false;  // 双向同步防回环

let hintEl = null;
let linkBox = null;
let statsCells = [];

export async function mount(el, panel) {
	container = el;
	container.classList.add('split');
	const pane3d = addPane('3d', '三维模型');
	const paneCad = addPane('cad', '二维图纸');

	viewer3d = new MinBIM.Viewer(pane3d.id);
	viewer3d.init({
		config: { assetsDir: assetUrl('assets') },
		background: 'transparent',
		toolbar: true,
		tree: false,          // 结构树读全局存储（整体替换语义），多模型只留最后一批，本示例不用
		dynamicCenter: false, // 动态旋转中心不经过 OrbitControls 事件，end 同步会漏
	});
	viewer3d.renderRequested = true;

	viewerCad = new MinBIMCAD.Viewer(paneCad.id);
	viewerCad.init({ config: { assetsDir: assetUrl('assets') } });

	buildPanel(panel);
	watchRegister();

	// 三维模型串行加载（避免并发写全局存储竞态）；图纸是独立引擎，与模型并行
	loader = new MinBIM.Loader(viewer3d, true);
	MODELS.forEach((m) => { loadChain = loadChain.then(() => loader.load(assetUrl(m.dir))); });
	await Promise.all([
		loadChain.then(() => viewer3d.focus(viewer3d.models)),
		viewerCad.load(assetUrl('models/sample-cad/manifest.json')),
	]);
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

// ---------------- 配准 ----------------

function startRegister() {
	pairs = { p3d: [], p2d: [] };
	regStep = '3d-1';
	map = null;
	linkBox.checked = false;
	linkBox.disabled = true;
	linkOn = false;
	viewer3d.picker.disable(); // 配准期间只取点不选构件
	viewer3d.snapper.enabled = true;
	hintEl.textContent = '第 1 点：在三维模型中点击一个特征点（如柱角、墙角，自动吸附）';
}

// 配准取点：三维侧监听 snapper 的 pick 事件，图纸侧主动调用 pick()
function watchRegister() {
	viewer3d.snapper.addEventListener('pick', (e) => {
		if (!regStep || !regStep.startsWith('3d')) return;
		pairs.p3d.push({ x: e.point.x, z: e.point.z });
		regStep = regStep === '3d-1' ? '2d-1' : '2d-2';
		viewer3d.snapper.enabled = false;
		viewerCad.snapper.enabled = true; // 图纸侧开启吸附指示
		hintEl.textContent = (regStep === '2d-1' ? '第 1 点' : '第 2 点') + '：在图纸上点击对应的同一位置（自动吸附端点/交点）';
	});

	// 图纸侧：单击取点（与拖拽平移共存：按下/抬起位移小于 5px 视为单击）
	let downPos = null;
	viewerCad.canvas.addEventListener('mousedown', (e) => { downPos = { x: e.clientX, y: e.clientY }; });
	viewerCad.canvas.addEventListener('mouseup', (e) => {
		const moved = downPos ? Math.hypot(e.clientX - downPos.x, e.clientY - downPos.y) : 0;
		downPos = null;
		if (moved >= 5) { syncToModel(); return; }
		if (!regStep || !regStep.startsWith('2d')) return;
		const snap = viewerCad.snapper.pick(e.clientX, e.clientY);
		const p = snap || viewerCad.camera.screenToWorld(e.clientX, e.clientY);
		pairs.p2d.push({ x: p.x, y: p.y });
		if (regStep === '2d-1') {
			regStep = '3d-2';
			viewerCad.snapper.enabled = false;
			viewer3d.snapper.enabled = true;
			hintEl.textContent = '第 2 点：在三维模型中点击另一个特征点（离第 1 点尽量远）';
		} else {
			finishRegister();
		}
	});
	viewerCad.canvas.addEventListener('wheel', () => syncToModel());

	// 三维交互结束（旋转/平移/滚轮）后同步视窗到图纸，拖动中不同步避免抖动
	viewer3d.controls.addEventListener('end', () => syncToCad());
}

function finishRegister() {
	regStep = null;
	viewer3d.snapper.enabled = false;
	viewer3d.picker.enable(); // 恢复构件选择
	viewerCad.snapper.enabled = false;
	computeMap();
	hintEl.textContent = '配准完成。若联动方向镜像，点「翻转 Y」后重试。';
	linkBox.disabled = false;
	linkBox.checked = true;
	linkOn = true;
	syncToCad();
}

// 由两个点对求比例与平移（s = 两点图纸距离 / 模型距离）
function computeMap() {
	const [a3, b3] = pairs.p3d;
	const [a2, b2] = pairs.p2d;
	const s = Math.hypot(b2.x - a2.x, b2.y - a2.y) / Math.hypot(b3.x - a3.x, b3.z - a3.z);
	map = { s, ox: a2.x - s * a3.x, oy: a2.y - s * ySign * a3.z };
	statsCells[0].textContent = `1 : ${s.toFixed(2)}`;
}

function toCad(x, z) {
	return { x: map.ox + map.s * x, y: map.oy + map.s * ySign * z };
}

function toModel(X, Y) {
	return { x: (X - map.ox) / map.s, z: (Y - map.oy) / (map.s * ySign) };
}

// ---------------- 视窗区域同步 ----------------

// 三维可视地面宽度（透视相机按距离估算，斜视时为近似值）
function groundWidth3d() {
	const cam = viewer3d.camera;
	if (cam.isOrthographicCamera) return (cam.right - cam.left) / cam.zoom;
	return 2 * cam.position.distanceTo(viewer3d.controls.target) * Math.tan(cam.fov * Math.PI / 360) * cam.aspect;
}

// 3D → 2D：交互结束（controls end）后把视窗中心与宽度同步给图纸
function syncToCad() {
	if (!linkOn || !map || syncing) return;
	syncing = true;
	const t = viewer3d.controls.target;
	viewerCad.restoreView({
		position: toCad(t.x, t.z),
		zoom: viewerCad.canvas.clientWidth / (groundWidth3d() * map.s),
	}, 0);
	syncing = false;
}

// 2D → 3D：图纸平移/缩放后，三维切为正上方俯视并对准同一区域
function syncToModel() {
	if (!linkOn || !map || syncing) return;
	syncing = true;
	const view = viewerCad.getView();
	const m = toModel(view.position.x, view.position.y);
	const w3 = viewerCad.canvas.clientWidth / view.zoom / map.s;
	const cam = viewer3d.camera;
	const controls = viewer3d.controls;
	let dist;
	if (cam.isOrthographicCamera) {
		dist = cam.position.distanceTo(controls.target); // 正交保持原距离
		cam.zoom = (cam.right - cam.left) / w3;
		cam.updateProjectionMatrix();
	} else {
		dist = w3 / (2 * Math.tan(cam.fov * Math.PI / 360) * cam.aspect);
	}
	controls.target.set(m.x, 0, m.z);
	cam.position.set(m.x, dist, m.z); // 正上方俯视
	controls.update();
	viewer3d.renderRequested = true;
	syncing = false;
}

// ---------------- 面板 ----------------

function buildPanel(panel) {
	const group = document.createElement('div');
	group.className = 'action-group';
	group.innerHTML = '<h2>图模联动</h2>';
	panel.appendChild(group);

	const regBtn = document.createElement('button');
	regBtn.className = 'action-btn';
	regBtn.textContent = '开始配准';
	regBtn.addEventListener('click', startRegister);
	group.appendChild(regBtn);

	hintEl = document.createElement('p');
	hintEl.style.cssText = 'font-size:12px;color:#8b96a8;line-height:1.6;margin:8px 0;';
	hintEl.textContent = '点「开始配准」，按提示在两侧各点两个对应的特征位置（柱角、轴网交点等），即可建立平面映射。';
	group.appendChild(hintEl);

	const linkRow = document.createElement('label');
	linkRow.className = 'ui-check';
	linkBox = document.createElement('input');
	linkBox.type = 'checkbox';
	linkBox.disabled = true;
	linkBox.addEventListener('change', () => { linkOn = linkBox.checked; if (linkOn) syncToCad(); });
	const linkText = document.createElement('span');
	linkText.textContent = '视窗联动';
	linkRow.append(linkBox, linkText);
	group.appendChild(linkRow);

	const flipBtn = document.createElement('button');
	flipBtn.className = 'action-btn';
	flipBtn.textContent = '翻转 Y';
	flipBtn.addEventListener('click', () => {
		if (!map) return;
		ySign = -ySign;
		computeMap();
		syncToCad();
	});
	group.appendChild(flipBtn);

	const statsGroup = document.createElement('div');
	statsGroup.className = 'action-group';
	statsGroup.innerHTML = '<h2>配准信息</h2>';
	panel.appendChild(statsGroup);
	const stats = createStats([
		{ label: '图纸/模型比例', value: '—' },
	], { columns: 1 });
	stats.querySelectorAll('.ui-stat b').forEach((b) => statsCells.push(b));
	statsGroup.appendChild(stats);
}

// 契约：切换示例时沙箱会调用，必须 dispose viewer，否则 WebGL 上下文耗尽
export function destroy() {
	if (viewer3d) viewer3d.dispose();
	if (viewerCad) viewerCad.dispose();
	if (container) container.classList.remove('split');
	container = null;
	viewer3d = null;
	viewerCad = null;
	loader = null;
	loadChain = Promise.resolve();
	map = null;
	pairs = null;
	regStep = null;
	linkOn = false;
	syncing = false;
	ySign = -1;
	hintEl = null;
	linkBox = null;
	statsCells = [];
}

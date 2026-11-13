// 02 · 多专业模型协同查看
// API 以 https://www.minbim.com/docs.html 为准
import { assetUrl } from '../../shared/js/paths.js';
import { createStats } from '../../shared/js/ui.js';

const DISCIPLINES = [
	{ key: 'ar', name: '建筑 (AR)', dir: 'models/multi-discipline/ar' },
	{ key: 'st', name: '结构 (ST)', dir: 'models/multi-discipline/st' },
	{ key: 'mep', name: '机电 (MEP)', dir: 'models/multi-discipline/mep' },
	{ key: 'mq', name: '幕墙 (MQ)', dir: 'models/multi-discipline/mq' },
];

let viewer = null;
let loader = null;
let statsEl = null;
let hasFocused = false;
let loadChain = Promise.resolve(); // 加载串行排队：并发写全局数据存储会互相覆盖
let progressCb = null;             // 当前加载中的专业行进度回调

export async function mount(container, panel) {
	viewer = new MinBIM.Viewer(container.id);
	viewer.init({
		config: { assetsDir: assetUrl('assets') },
		background: 'transparent'
	});
	viewer.renderRequested = true;
	loader = new MinBIM.Loader(viewer, true, (p) => progressCb?.(p));

	// 专业复选列表：勾选加载 / 取消隐藏
	const group = document.createElement('div');
	group.className = 'action-group';
	group.innerHTML = '<h2>专业模型</h2>';
	panel.appendChild(group);

	DISCIPLINES.forEach((d) => {
		const row = document.createElement('label');
		row.className = 'ui-check';
		const box = document.createElement('input');
		box.type = 'checkbox';
		const text = document.createElement('span');
		text.textContent = d.name;
		const state = document.createElement('i');
		state.className = 'ui-check-state';
		state.textContent = '未加载';
		row.append(box, text, state);
		d._box = box;
		d._state = state;
		box.addEventListener('change', () => toggleDiscipline(d));
		group.appendChild(row);
	});

	statsEl = createStats([
		{ label: '已加载模型', value: 0 },
		{ label: '构件总数', value: 0 },
		{ label: '三角面总数', value: 0 }
	], { columns: 2 });
	panel.appendChild(statsEl);
}

// 已加载的专业勾选即显隐，未加载的勾选进入加载队列
function toggleDiscipline(d) {
	if (d.model) {
		d.model.visible = d._box.checked;
		d._state.textContent = d._box.checked ? '已加载' : '已隐藏';
		viewer.renderRequested = true;
		return;
	}
	if (!d._box.checked || d.loading) return;
	d.loading = true;
	d._state.textContent = '排队中…';
	loadChain = loadChain.then(() => loadDiscipline(d));
}

async function loadDiscipline(d) {
	if (!d._box.checked) { // 排队期间被取消
		d.loading = false;
		d._state.textContent = '未加载';
		return;
	}
	progressCb = (p) => { d._state.textContent = `加载中 ${p}%`; };
	d._state.textContent = '加载中 0%';
	try {
		d.model = await loader.load(assetUrl(d.dir));
		// 全局数据存储为整体替换语义：先取出本批数据，合并后回填
		d.nodes = loader.getNode();
		d.properties = loader.getProperty();
		d.fileInfo = loader.getFileInfo();
		refreshStore();
		d._state.textContent = '已加载';
		if (!hasFocused) {
			hasFocused = true;
			viewer.focus(d.model);
		} else {
			viewer.renderRequested = true;
		}
	} catch (err) {
		console.error(err);
		d._box.checked = false;
		d._state.textContent = '加载失败';
	} finally {
		progressCb = null;
		d.loading = false;
	}
}

// 合并各批次节点/属性/文件信息回填，结构树随之重建
function refreshStore() {
	const loaded = DISCIPLINES.filter((d) => d.nodes);
	// 每个专业包一层分组节点
	loader.setNode(loaded.map((d) => ({ name: d.name, children: d.nodes })));
	loader.setProperty(loaded.flatMap((d) => d.properties || []));
	// 文件信息：名称并列，数量求和，类型/版本/单位去重
	const infos = loaded.map((d) => d.fileInfo || {});
	const sum = (key) => infos.reduce((n, i) => n + (i[key] || 0), 0);
	const uniq = (key) => [...new Set(infos.map((i) => i[key]).filter((v) => v !== undefined))].join(' / ') || undefined;
	loader.setFileInfo({
		fileName: infos.map((i) => i.fileName).filter(Boolean).join(' / ') || undefined,
		fileType: uniq('fileType'),
		fileVersion: uniq('fileVersion'),
		unit: uniq('unit'),
		fileSize: sum('fileSize'),
		componentCount: sum('componentCount'),
		triangleCount: sum('triangleCount'),
		vertexCount: sum('vertexCount'),
	});
	viewer.tree?.refresh();
	const cells = statsEl.querySelectorAll('.ui-stat b');
	cells[0].textContent = loaded.length;
	cells[1].textContent = sum('componentCount');
	cells[2].textContent = sum('triangleCount');
}

// 沙箱切换示例时调用，必须 dispose viewer，否则 WebGL 上下文耗尽
export function destroy() {
	if (viewer) viewer.dispose();
	viewer = null;
	loader = null;
	statsEl = null;
	progressCb = null;
	hasFocused = false;
	loadChain = Promise.resolve();
	DISCIPLINES.forEach((d) => {
		d.model = d.nodes = d.properties = d.fileInfo = null;
		d.loading = false;
		d._box = d._state = null;
	});
}

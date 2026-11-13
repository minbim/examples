// 04 · BIM 构件问题与整改管理
// API 以 https://www.minbim.com/docs.html 为准
// 文件分工：main.js=引擎 API 主线；issue-data.js=演示问题数据；issue-panel.js=清单抽屉 UI（纯 DOM）
import { assetUrl } from '../../shared/js/paths.js';
import { createStats } from '../../shared/js/ui.js';
import { STATUS, deriveIssues, createIssue } from './issue-data.js';
import { createIssuePanel } from './issue-panel.js';

const MODEL_DIR = 'models/multi-discipline/st';
const ISOLATE_OPACITY = 0.02; // 「只看问题构件」时非问题构件的半透明度

let viewer = null;
let marker = null;
let issuePanel = null;

let issues = [];           // 全部问题记录（结构见 issue-data.js）
let guidInfo = new Map();  // guid -> { name, category }
let allGuids = [];         // 全部叶子构件 guid（隔离凸显用）

let selectedIssue = null;
let registerArmed = false; // 登记模式：下一次点击构件即登记新问题
let isolateOn = false;

// 应用层多选：「多选构件」按钮开启，或按住 ctrl/cmd 临时进入
let multiOn = false;
let ctrlHeld = false;
let multiIds = [];

let statsCells = [];
let drawerBtn = null;
let registerBtn = null;
let multiBtn = null;
let isolateBtn = null;

const isMulti = () => multiOn || ctrlHeld;

export async function mount(container, panel) {
	viewer = new MinBIM.Viewer(container.id);
	viewer.init({
		config: { assetsDir: assetUrl('assets') },
		background: 'transparent'
	});
	viewer.renderRequested = true;
	marker = new MinBIM.Widget.Marker(viewer);
	marker.addEventListener('click', (e) => {
		const hit = issues.find((it) => it.id === e.id);
		if (hit) {
			setDrawerOpen(true); // 抽屉关着时先拉开，否则看不到详情
			selectIssue(hit);
		}
	});

	const loader = new MinBIM.Loader(viewer, true);
	const model = await loader.load(assetUrl(MODEL_DIR));
	({ issues, guidInfo, allGuids } = deriveIssues(loader.getNode()));
	viewer.focus(model);

	buildPanel(panel);
	issuePanel = createIssuePanel({
		onSelect: (issue) => selectIssue(issue),
		onSetStatus: (issue, status) => setStatus(issue, status)
	});
	container.parentElement.appendChild(issuePanel.el);

	// 探针剔除无几何构件（有节点无网格，如标高/参照），再重编号并重建标记
	const markerOk = issues.map((it) => addIssueMarker(it) !== null);
	issues = issues.filter((_, i) => markerOk[i]);
	issues.forEach((it, i) => { it.id = 'ISS-' + String(i + 1).padStart(3, '0'); });
	marker.clear();
	issues.forEach(addIssueMarker);
	issuePanel.update(issues, null);
	updateStats();
	setDrawerOpen(true);

	// ctrl/cmd 按住 = 临时多选
	window.addEventListener('keydown', onKeyDown);
	window.addEventListener('keyup', onKeyUp);

	// 反向联动与多选累计：同一事件回调里 setSelected 恢复整组，按需渲染只画最终状态
	viewer.picker.addEventListener('selected', (e) => {
		const id = String(e.id);
		if (registerArmed) {
			registerIssue(id);
			return;
		}
		if (isMulti()) {
			if (!multiIds.includes(id)) multiIds.push(id);
			viewer.picker.setSelected(multiIds, true, false);
			return;
		}
		multiIds = [id];
		const hit = issues.find((it) => it.guids.includes(id));
		if (hit) {
			setDrawerOpen(true);
			selectIssue(hit, true);
		}
	});
	// 多选模式下再次点击已选构件 = 移出集合
	viewer.picker.addEventListener('deselect', (e) => {
		if (registerArmed) return;
		if (isMulti()) {
			multiIds = multiIds.filter((g) => g !== String(e.id));
			if (multiIds.length) viewer.picker.setSelected(multiIds, true, false);
			return;
		}
		multiIds = [];
		selectIssue(null);
	});
	// 多选模式下点空白不清组
	viewer.picker.addEventListener('unselected', () => {
		if (registerArmed) return; // 登记模式下点到空白不退出
		if (isMulti() && multiIds.length) {
			viewer.picker.setSelected(multiIds, true, false);
			return;
		}
		multiIds = [];
		selectIssue(null);
	});
}

function onKeyDown(e) {
	if (e.key === 'Control' || e.key === 'Meta') ctrlHeld = true;
}

function onKeyUp(e) {
	if (e.key === 'Control' || e.key === 'Meta') ctrlHeld = false;
}

// 问题标记：单构件→点标记（序号文字），多构件→云线区域标记，颜色与清单徽章同色
// 返回添加结果（guid 无几何时为 null，供探针剔除）
function addIssueMarker(issue) {
	const color = STATUS[issue.status].color;
	if (issue.guids.length > 1) {
		return marker.addCloud({ id: issue.id, guids: issue.guids, color });
	}
	return marker.add({ id: issue.id, guid: issue.guids[0], color, text: String(Number(issue.id.split('-')[1])) });
}

// 选中问题（清单 / 标记 / 模型反查共用）：高亮聚焦构件 + 刷新清单与详情
function selectIssue(issue, fromModel = false) {
	selectedIssue = issue;
	if (issue) {
		if (fromModel) issuePanel.reveal(issue); // 当前筛选看不到时自动切回「全部」
		if (!fromModel) {
			multiIds = issue.guids.slice(); // 多选集合跟随当前问题
			viewer.picker.setSelected(issue.guids);
		}
	} else {
		multiIds = [];
		viewer.picker.clearSelection();
	}
	issuePanel.update(issues, selectedIssue);
}

// 登记新问题：单个 guid 或 guid 数组；构件已有问题则改为定位
function registerIssue(input) {
	setArmed(false);
	const guids = [...new Set([].concat(input))].filter((g) => guidInfo.has(g));
	if (!guids.length) return;
	if (guids.length === 1) {
		const existing = issues.find((it) => it.guids.includes(guids[0]));
		if (existing) {
			selectIssue(existing, true);
			return;
		}
	}
	const issue = createIssue(guids, guidInfo, issues.length);
	issues.push(issue);
	addIssueMarker(issue); // 多构件组自动画云线
	if (isolateOn) applyIsolate(); // 新构件退出半透明集合
	updateStats();
	selectIssue(issue);
}

function setArmed(v) {
	registerArmed = v;
	registerBtn.classList.toggle('armed', v);
	registerBtn.textContent = v ? '请点击模型中的构件…' : '登记问题';
}

function setMulti(v) {
	multiOn = v;
	multiBtn.classList.toggle('armed', v);
	multiBtn.textContent = v ? '完成多选' : '多选构件';
}

// 「只看问题构件」：非问题构件半透明，问题构件保持实体
function applyIsolate() {
	viewer.display.showAll();
	if (isolateOn) {
		const issueGuids = new Set(issues.flatMap((it) => it.guids));
		const others = allGuids.filter((g) => !issueGuids.has(g));
		viewer.display.setTransparent(others, ISOLATE_OPACITY);
	}
	isolateBtn.textContent = isolateOn ? '显示全部构件' : '只看问题构件';
	isolateBtn.classList.toggle('armed', isolateOn);
}

function setStatus(issue, status) {
	if (issue.status === status) return;
	issue.status = status;
	marker.setColor(issue.id, STATUS[status].color); // 标记与徽章同色
	issuePanel.update(issues, selectedIssue);
	updateStats();
}

function setDrawerOpen(v) {
	issuePanel.setOpen(v);
	drawerBtn.classList.toggle('armed', v);
}

function buildPanel(panel) {
	const ops = document.createElement('div');
	ops.className = 'action-group';
	ops.innerHTML = '<h2>问题管理</h2>';
	panel.appendChild(ops);

	drawerBtn = document.createElement('button');
	drawerBtn.className = 'action-btn';
	drawerBtn.textContent = '问题清单';
	drawerBtn.addEventListener('click', () => setDrawerOpen(!issuePanel.isOpen()));
	ops.appendChild(drawerBtn);

	registerBtn = document.createElement('button');
	registerBtn.className = 'action-btn';
	registerBtn.textContent = '登记问题';
	registerBtn.addEventListener('click', () => {
		// 多选组满 2 个构件时直接登记为区域问题
		if (multiIds.length >= 2) {
			registerIssue(multiIds);
			return;
		}
		setArmed(!registerArmed);
	});
	ops.appendChild(registerBtn);

	multiBtn = document.createElement('button');
	multiBtn.className = 'action-btn';
	multiBtn.textContent = '多选构件';
	multiBtn.title = '逐个点选构件组成多选组（按住 ctrl 可临时多选），再点「登记问题」圈出云线';
	multiBtn.addEventListener('click', () => setMulti(!multiOn));
	ops.appendChild(multiBtn);

	isolateBtn = document.createElement('button');
	isolateBtn.className = 'action-btn';
	isolateBtn.textContent = '只看问题构件';
	isolateBtn.addEventListener('click', () => {
		isolateOn = !isolateOn;
		applyIsolate();
	});
	ops.appendChild(isolateBtn);

	// 统计组
	const statsGroup = document.createElement('div');
	statsGroup.className = 'action-group';
	statsGroup.innerHTML = '<h2>整改统计</h2>';
	panel.appendChild(statsGroup);
	statsCells = [];
	const el = createStats([
		{ label: '待整改', value: 0 },
		{ label: '整改中', value: 0 },
		{ label: '已整改', value: 0 },
		{ label: '总问题', value: 0 }
	], { columns: 2 });
	el.querySelectorAll('.ui-stat b').forEach((b) => statsCells.push(b));
	statsGroup.appendChild(el);
}

function updateStats() {
	const counts = [0, 0, 0];
	issues.forEach((it) => counts[it.status]++);
	statsCells[0].textContent = counts[0];
	statsCells[1].textContent = counts[1];
	statsCells[2].textContent = counts[2];
	statsCells[3].textContent = issues.length;
}

// 沙箱切换示例时调用，必须 dispose viewer，否则 WebGL 上下文耗尽
export function destroy() {
	window.removeEventListener('keydown', onKeyDown);
	window.removeEventListener('keyup', onKeyUp);
	if (issuePanel) issuePanel.el.remove();
	if (marker) marker.dispose();
	if (viewer) viewer.dispose();
	viewer = null;
	marker = null;
	issuePanel = null;
	issues = [];
	guidInfo = new Map();
	allGuids = [];
	selectedIssue = null;
	registerArmed = false;
	isolateOn = false;
	multiOn = false;
	ctrlHeld = false;
	multiIds = [];
	statsCells = [];
	drawerBtn = null;
	registerBtn = null;
	multiBtn = null;
	isolateBtn = null;
}

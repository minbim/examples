// 03 · 施工进度模拟
// API 以 https://www.minbim.com/docs.html 为准
import { assetUrl } from '../../shared/js/paths.js';
import { createSlider, createStats } from '../../shared/js/ui.js';
import { createGantt } from './gantt.js';

const MODEL_DIR = 'models/multi-discipline/st'; // 换模型改这里，进度数据从结构树推导
const T0 = new Date(2026, 2, 1); // 2026-03-01
const TOTAL_DAYS = 121;          // 至 2026-06-30

// 构件三态：未开始=隐藏，施工中=半透明，已完成=实体
const STATE = { TODO: 0, DOING: 1, DONE: 2 };
const STATE_OPACITY = 0.5;

// 施工逻辑排序关键词：类别名命中越靠前越早开工，未命中排最后
const ORDER_KEYWORDS = ['基础', '承台', '垫层', '柱', '墙', '梁', '框架', '板', '楼板', '楼梯', '坡道', '栏杆', '幕墙', '屋面', '门', '窗'];

let viewer = null;
let gantt = null;
let slider = null;
let statsCells = null;
let playBtn = null;

let items = [];            // 扁平构件计划 [{ id, s, e }]，s/e 为开工/完工日（相对 T0 的天数）
let stateMap = new Map();  // guid -> 当前状态，增量更新用
let currentDay = -1;
let playTimer = null;

export async function mount(container, panel) {
	viewer = new MinBIM.Viewer(container.id);
	viewer.init({
		config: { assetsDir: assetUrl('assets') },
		background: 'transparent'
	});
	viewer.renderRequested = true;

	const loader = new MinBIM.Loader(viewer, true);
	const model = await loader.load(assetUrl(MODEL_DIR));
	const tasks = deriveSchedule(loader.getNode());
	viewer.focus(model);

	buildPanel(panel);
	// 甘特图抽屉挂在 viewer-wrap 底部
	gantt = createGantt({ tasks, totalDays: TOTAL_DAYS, startDate: T0, onSeek: (day) => setDate(day) });
	container.parentElement.appendChild(gantt.el);

	setDate(0);
}

// 从结构树推导施工计划：每个类别=一个任务，按施工逻辑排序后错峰分配起止窗口，
// 构件在任务窗口内加哈希抖动，避免整齐翻转
function deriveSchedule(nodes) {
	const tasks = [];
	(nodes || []).forEach((root) => {
		const cats = root.children && root.children.length ? root.children : [root];
		cats.forEach((cat) => {
			const guids = collectGuids(cat);
			if (guids.length) tasks.push({ name: cat.name || '未命名', guids });
		});
	});

	const order = (t) => {
		const i = ORDER_KEYWORDS.findIndex((k) => t.name.includes(k));
		return i === -1 ? ORDER_KEYWORDS.length : i;
	};
	tasks.sort((a, b) => order(a) - order(b));

	items = [];
	const n = tasks.length;
	tasks.forEach((t, i) => {
		t.start = Math.round((i / n) * TOTAL_DAYS * 0.6);
		t.end = Math.min(TOTAL_DAYS, t.start + Math.round(TOTAL_DAYS * 0.5));
		t.guids.forEach((id) => {
			const shift = Math.round((hash01(id) - 0.5) * 0.3 * (t.end - t.start));
			const s = Math.max(0, t.start + shift);
			items.push({ id, s, e: Math.max(s + 1, Math.min(TOTAL_DAYS, t.end + shift)) });
		});
	});
	return tasks;
}

function collectGuids(node, out = []) {
	if (node.guid) out.push(node.guid);
	(node.children || []).forEach((c) => collectGuids(c, out));
	return out;
}

// guid 稳定哈希到 [0,1)
function hash01(s) {
	let h = 0;
	for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
	return (h % 1000) / 1000;
}

// 日期统一切口：滑块 / 播放 / 甘特图定位都走这里
function setDate(day) {
	day = Math.max(0, Math.min(TOTAL_DAYS, day));
	currentDay = day;
	applyStates(day);
	updateStats();

	slider.input.value = day;
	slider.valueEl.textContent = fmtDate(day);
	gantt.setDate(day);
}

// 增量应用三态：只更新状态变化的构件
function applyStates(day) {
	const todo = [], doing = [], done = [];
	items.forEach((it) => {
		const st = day < it.s ? STATE.TODO : day < it.e ? STATE.DOING : STATE.DONE;
		if (stateMap.get(it.id) === st) return;
		stateMap.set(it.id, st);
		if (st === STATE.TODO) todo.push(it.id);
		else if (st === STATE.DOING) doing.push(it.id);
		else done.push(it.id);
	});
	if (todo.length) viewer.display.hide(todo);
	if (doing.length) viewer.display.setTransparent(doing, STATE_OPACITY);
	if (done.length) viewer.display.show(done);
}

function updateStats() {
	const counts = [0, 0, 0];
	stateMap.forEach((st) => counts[st]++);
	statsCells[0].textContent = Math.round((counts[STATE.DONE] / items.length) * 100) + '%';
	statsCells[1].textContent = counts[STATE.DONE];
	statsCells[2].textContent = counts[STATE.DOING];
	statsCells[3].textContent = counts[STATE.TODO];
}

function togglePlay() {
	if (playTimer) {
		stopPlay();
		return;
	}
	if (currentDay >= TOTAL_DAYS) setDate(0); // 播到头再点播放 = 重头开始
	playBtn.textContent = '暂停';
	playTimer = setInterval(() => {
		if (currentDay >= TOTAL_DAYS) {
			stopPlay();
			return;
		}
		setDate(currentDay + 1);
	}, 100);
}

function stopPlay() {
	clearInterval(playTimer);
	playTimer = null;
	playBtn.textContent = '播放';
}

function fmtDate(day) {
	const d = new Date(T0.getTime() + day * 864e5);
	return `${d.getMonth() + 1}月${d.getDate()}日`;
}

function buildPanel(panel) {
	// 进度控制组：图例 + 时间轴 + 播放 / 甘特图按钮
	const group = document.createElement('div');
	group.className = 'action-group';
	group.innerHTML = '<h2>进度模拟</h2>';
	panel.appendChild(group);

	const legend = document.createElement('div');
	legend.className = 'legend';
	legend.innerHTML =
		'<span><i class="legend-done"></i>已完成</span>' +
		'<span><i class="legend-doing"></i>施工中</span>' +
		'<span><i class="legend-todo"></i>未开始</span>';
	group.appendChild(legend);

	slider = createSlider({
		label: '当前日期', min: 0, max: TOTAL_DAYS, value: 0,
		onInput: (day) => setDate(day)
	});
	group.appendChild(slider);

	playBtn = document.createElement('button');
	playBtn.className = 'action-btn';
	playBtn.textContent = '播放';
	playBtn.addEventListener('click', togglePlay);
	group.appendChild(playBtn);

	const ganttBtn = document.createElement('button');
	ganttBtn.className = 'action-btn';
	ganttBtn.textContent = '进度甘特图';
	ganttBtn.addEventListener('click', () => gantt.toggle());
	group.appendChild(ganttBtn);

	// 统计组
	const statsGroup = document.createElement('div');
	statsGroup.className = 'action-group';
	statsGroup.innerHTML = '<h2>进度统计</h2>';
	panel.appendChild(statsGroup);
	statsCells = [];
	const el = createStats([
		{ label: '完成率', value: '-' },
		{ label: '已完成', value: 0 },
		{ label: '施工中', value: 0 },
		{ label: '未开始', value: 0 }
	], { columns: 2 });
	el.querySelectorAll('.ui-stat b').forEach((b) => statsCells.push(b));
	statsGroup.appendChild(el);
}

// 沙箱切换示例时调用，必须 dispose viewer，否则 WebGL 上下文耗尽
export function destroy() {
	stopPlay();
	if (gantt) gantt.el.remove();
	if (viewer) viewer.dispose();
	viewer = null;
	gantt = null;
	slider = null;
	statsCells = null;
	playBtn = null;
	items = [];
	stateMap = new Map();
	currentDay = -1;
	playTimer = null;
}

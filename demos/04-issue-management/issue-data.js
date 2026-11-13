// 演示数据：从结构树推导问题清单（纯数据，不依赖引擎与 DOM）。
// 真实项目中本模块替换为问题台账接口（列表 / 新增 / 改状态），main.js 交互逻辑不变。

// 问题状态流转：待整改 → 整改中 → 已整改；color 同时用于清单徽章（见 sandbox.css .issue-badge）与场景标记
export const STATUS = [
	{ name: '待整改', color: '#c94f43' },
	{ name: '整改中', color: '#d99a17' },
	{ name: '已整改', color: '#43a66f' }
];

// 问题描述模板：按类别/构件名关键词命中，未命中用兜底模板
const TEMPLATES = [
	{ kw: '柱', title: '柱垂直度偏差超限', desc: '现场实测柱垂直度偏差超过规范允许值，需复核模板定位并整改。' },
	{ kw: '墙', title: '剪力墙钢筋保护层不足', desc: '保护层厚度实测不足，存在耐久性隐患，需按设计要求整改。' },
	{ kw: '梁', title: '梁底箍筋间距不均', desc: '箍筋间距局部超出设计值，需排查绑扎质量并整改。' },
	{ kw: '板', title: '板面裂缝渗水', desc: '楼板面发现贯通裂缝，雨天渗水，需注浆封闭处理。' },
	{ kw: '楼梯', title: '楼梯踏步高差不均', desc: '相邻踏步高差超出规范限值，影响使用安全，需修整。' },
	{ kw: '基础', title: '基础混凝土蜂窝麻面', desc: '基础侧面出现蜂窝麻面，需凿毛修补并加强养护。' },
	{ kw: '承台', title: '承台标高偏差', desc: '承台顶面标高与图纸不符，需复核沉降观测数据。' }
];
const FALLBACK_TPL = { title: '构件尺寸与图纸不符', desc: '现场实测尺寸与模型/图纸不一致，需复核后整改。' };

const ASSIGNEES = ['张工', '李工', '王工', '赵工'];
const PRIORITIES = ['高', '中', '低'];
const FOUND_T0 = new Date(2026, 9, 1); // 2026-10-01，演示发现日期的起点

// 从结构树推导演示问题记录：每类别按 guid 哈希排序取前 2 个构件挂问题，
// 责任人/优先级/发现日期/初始状态均由 guid 哈希稳定生成，换模型免维护。
// 返回 { issues, guidInfo, allGuids }：guidInfo = guid -> { name, category }，allGuids = 全部叶子构件 guid
export function deriveIssues(nodes) {
	const guidInfo = new Map();
	const allGuids = [];
	// 结构树索引：层级为 根 → 类别 → 类型 → 叶子构件（带 guid）
	(nodes || []).forEach((root) => {
		const cats = root.children && root.children.length ? root.children : [root];
		cats.forEach((cat) => {
			const category = cat.name || '未分类';
			collectLeaves(cat).forEach((leaf) => {
				if (guidInfo.has(leaf.guid)) return;
				guidInfo.set(leaf.guid, { name: leaf.name || leaf.guid, category });
				allGuids.push(leaf.guid);
			});
		});
	});

	const byCat = new Map();
	guidInfo.forEach((info, guid) => {
		if (!byCat.has(info.category)) byCat.set(info.category, []);
		byCat.get(info.category).push(guid);
	});
	const issues = [];
	byCat.forEach((guids, category) => {
		guids.slice().sort((a, b) => hash01(a) - hash01(b)).slice(0, 2).forEach((guid) => {
			const info = guidInfo.get(guid);
			const tpl = findTemplate(category, info.name);
			const r = hash01(guid + '#s');
			issues.push({
				guids: [guid],
				category,
				component: info.name,
				title: tpl.title,
				desc: tpl.desc,
				assignee: ASSIGNEES[Math.floor(hash01(guid + '#a') * ASSIGNEES.length)],
				priority: PRIORITIES[Math.floor(hash01(guid + '#p') * PRIORITIES.length)],
				foundDate: fmtDate(FOUND_T0, Math.floor(hash01(guid + '#d') * 28)),
				status: r < 0.4 ? 0 : r < 0.75 ? 1 : 2
			});
		});
	});
	// 区域问题（碰撞冲突演示对）：优先 梁/柱/墙 类别下同类型节点的相邻两个构件，云线圈出
	const pair = findClashPair(nodes);
	if (pair) {
		const [g1, g2] = pair;
		const n1 = guidInfo.get(g1);
		const n2 = guidInfo.get(g2);
		issues.unshift({
			guids: pair,
			category: '碰撞检查',
			component: `${n1 ? n1.name : g1} × ${n2 ? n2.name : g2}`,
			title: '构件交叉冲突',
			desc: '两个构件空间位置交叉冲突，需现场复核并调整安装位置或顺序。',
			assignee: ASSIGNEES[0],
			priority: '高',
			foundDate: fmtDate(FOUND_T0, 0),
			status: 0
		});
	}
	// 保证三种状态都有样本，演示状态流转不空转
	if (issues.length >= 4) {
		if (!issues.some((i) => i.status === 0)) issues[1].status = 0;
		if (!issues.some((i) => i.status === 1)) issues[1].status = 1;
		if (!issues.some((i) => i.status === 2)) issues[2].status = 2;
	}
	issues.forEach((it, i) => { it.id = 'ISS-' + String(i + 1).padStart(3, '0'); });
	return { issues, guidInfo, allGuids };
}

// 登记新问题时生成记录：单构件按类别套模板，多构件组为区域冲突（云线圈出）
export function createIssue(guids, guidInfo, seq) {
	const now = new Date();
	const base = {
		id: 'ISS-' + String(seq + 1).padStart(3, '0'),
		guids,
		assignee: ASSIGNEES[seq % ASSIGNEES.length],
		foundDate: `${now.getMonth() + 1}月${now.getDate()}日`,
		status: 0
	};
	if (guids.length > 1) {
		return {
			...base,
			category: '碰撞检查',
			component: `${guids.length} 个构件`,
			title: '区域构件交叉冲突',
			desc: '多选组内多个构件存在空间交叉冲突，需逐构件复核并安排整改。',
			priority: '高'
		};
	}
	const info = guidInfo.get(guids[0]);
	const tpl = findTemplate(info.category, info.name);
	return {
		...base,
		category: info.category,
		component: info.name,
		title: tpl.title,
		desc: tpl.desc,
		priority: '中'
	};
}

function collectLeaves(node, out = []) {
	if (node.guid) {
		out.push(node);
		return out;
	}
	(node.children || []).forEach((c) => collectLeaves(c, out));
	return out;
}

// 找「交叉冲突」演示构件对：同类型节点下的前两个叶子构件
function findClashPair(nodes) {
	const pairs = [];
	const walk = (node, category) => {
		if (node.guid) return;
		const cat = category || node.name || '';
		const leaves = (node.children || []).filter((c) => c.guid);
		if (leaves.length >= 2) pairs.push({ category: cat, guids: [leaves[0].guid, leaves[1].guid] });
		(node.children || []).forEach((c) => walk(c, cat));
	};
	(nodes || []).forEach((n) => walk(n, ''));
	if (!pairs.length) return null;
	const hit = pairs.find((p) => ['梁', '柱', '墙'].some((k) => p.category.includes(k)));
	return (hit || pairs[0]).guids;
}

function findTemplate(category, component) {
	const text = category + component;
	const hit = TEMPLATES.find((t) => text.includes(t.kw));
	return hit || FALLBACK_TPL;
}

// guid 字符串哈希到 [0,1)，同 guid 恒定，换模型后仍稳定
function hash01(s) {
	let h = 0;
	for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
	return (h % 1000) / 1000;
}

function fmtDate(base, offsetDays) {
	const d = new Date(base.getTime() + offsetDays * 864e5);
	return `${d.getMonth() + 1}月${d.getDate()}日`;
}

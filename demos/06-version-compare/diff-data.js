// 演示数据：从结构树推导设计变更清单（纯数据，不依赖引擎与 DOM）。
// 真实项目中本模块替换为版本比对接口（新增 / 删除 / 修改构件清单），main.js 交互逻辑不变。

// 变更类型：color 同时用于模型着色与清单标记
export const TYPES = [
	{ name: '新增', color: '#43a66f' },
	{ name: '删除', color: '#c94f43' },
	{ name: '修改', color: '#d99a17' }
];

// 类型挑选规则：按类别关键词匹配，count 为该类型抽取的构件数
const TYPE_RULES = [
	{ type: 0, kw: ['窗', '门', '幕墙'], count: 5 },
	{ type: 1, kw: ['墙', '栏杆'], count: 4 },
	{ type: 2, kw: ['柱', '梁', '板', '楼梯'], count: 5 }
];

// 修改类变更的参数对比模板：按类别/构件名关键词命中
const MOD_TEMPLATES = [
	{ kw: '柱', label: '截面尺寸', before: '400×400', after: '500×500', desc: '结构复核后柱截面加大，注意核对钢筋排布与预留洞口。' },
	{ kw: '梁', label: '截面高度', before: '600mm', after: '750mm', desc: '承载力验算后梁高加大，注意核对净高与管线综合。' },
	{ kw: '板', label: '板厚', before: '120mm', after: '150mm', desc: '使用荷载调整，板厚加大，注意核对降板区标高。' },
	{ kw: '楼梯', label: '踏步宽度', before: '260mm', after: '280mm', desc: '按最新规范调整踏步尺寸，注意核对梯段净宽。' }
];
const FALLBACK_MOD = { label: '规格参数', before: '原设计值', after: '调整后值', desc: '设计参数调整，以最新版图纸为准。' };

const AUTHORS = ['张工', '李工', '王工', '赵工'];
const DATE_T0 = new Date(2026, 7, 1); // 2026-08-01，演示变更日期的起点

// 从结构树推导演示变更记录：按类别关键词分配变更类型，类别内按 guid 哈希排序取件，
// 提出人/日期由 guid 哈希稳定生成，换模型免维护。
// 返回 { changes, guidInfo }：changes 元素 { id, type, guid, name, category, title, desc, detail?, author, date }
export function deriveChanges(nodes) {
	const guidInfo = new Map();
	const byCat = new Map();
	// 结构树索引：层级为 根 → 类别 → 类型 → 叶子构件（带 guid）
	(nodes || []).forEach((root) => {
		const cats = root.children && root.children.length ? root.children : [root];
		cats.forEach((cat) => {
			const category = cat.name || '未分类';
			collectLeaves(cat).forEach((leaf) => {
				if (guidInfo.has(leaf.guid)) return;
				guidInfo.set(leaf.guid, { name: leaf.name || leaf.guid, category });
				if (!byCat.has(category)) byCat.set(category, []);
				byCat.get(category).push(leaf.guid);
			});
		});
	});

	const used = new Set();
	const changes = [];
	// 各类别 guid 按哈希排序，挑选结果稳定
	const sortedCats = new Map();
	byCat.forEach((guids, cat) => sortedCats.set(cat, guids.slice().sort((a, b) => hash01(a) - hash01(b))));

	const pick = (kw, count) => {
		const out = [];
		sortedCats.forEach((guids, cat) => {
			if (out.length >= count) return;
			if (!kw.some((k) => cat.includes(k))) return;
			for (const guid of guids) {
				if (out.length >= count) break;
				if (used.has(guid)) continue;
				used.add(guid);
				out.push({ guid, category: cat });
			}
		});
		return out;
	};

	TYPE_RULES.forEach((rule) => {
		pick(rule.kw, rule.count).forEach(({ guid, category }) => {
			changes.push(makeChange(rule.type, guid, category, guidInfo));
		});
	});

	// 关键词未命中导致某类为空时，从剩余构件兜底补齐，保证三类都有样本
	TYPES.forEach((_, type) => {
		if (changes.some((c) => c.type === type)) return;
		pick([''], 2).forEach(({ guid, category }) => {
			changes.push(makeChange(type, guid, category, guidInfo));
		});
	});

	changes.forEach((c, i) => { c.id = 'CHG-' + String(i + 1).padStart(3, '0'); });
	return { changes, guidInfo };
}

function makeChange(type, guid, category, guidInfo) {
	const name = guidInfo.get(guid).name;
	const base = {
		type,
		guid,
		name,
		category,
		author: AUTHORS[Math.floor(hash01(guid + '#a') * AUTHORS.length)],
		date: fmtDate(DATE_T0, Math.floor(hash01(guid + '#d') * 30))
	};
	if (type === 0) {
		return { ...base, title: `新增${name}`, desc: '新版图纸在该位置新增此构件，注意核对与相邻构件的交接做法。' };
	}
	if (type === 1) {
		return { ...base, title: `拆除${name}`, desc: '新版图纸中此构件已删除，现场如已施工需安排拆除并修补界面。' };
	}
	const tpl = MOD_TEMPLATES.find((t) => (category + name).includes(t.kw)) || FALLBACK_MOD;
	return {
		...base,
		title: `${name}参数调整`,
		desc: tpl.desc,
		detail: { label: tpl.label, before: tpl.before, after: tpl.after }
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

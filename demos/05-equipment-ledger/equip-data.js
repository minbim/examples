// 演示数据：从结构树推导设备台账（纯数据，不依赖引擎与 DOM）。
// 真实项目替换为资产台账接口（设备列表 / 维保记录），main.js 交互逻辑不变。

// 运行状态：color 同时用于弹框状态点与场景标记
export const STATUS = [
	{ name: '运行正常', color: '#43a66f' },
	{ name: '待维保', color: '#d99a17' },
	{ name: '故障', color: '#c94f43' }
];

const MAX_DEVICES = 12;                // 纳入台账的代表性设备数量
const MIN_UNITS = 6;                   // 认定"设备层"的最少节点数
const SERVICE_T0 = new Date(2026, 3, 1); // 演示维保日期起点
const SERVICE_CYCLE = 180;               // 维保周期（天）

// 推导台账：由浅入深找"设备层"——叶子祖先中第一个节点数达标的层（化工模型即 设备/管线 层），
// 该层节点即一台设备；设备名取节点名、类别取父分组名，全部叶子后代作为模型锚点候选；
// 找不到设备层时退化为叶子构件本身即设备；运行状态与维保日期由设备 key 哈希稳定生成
export function deriveDevices(nodes) {
	const allGuids = [];
	const leaves = [];
	(function walk(node, chain) {
		const kids = node.children || [];
		if (!kids.length) {
			if (node.guid != null) {
				allGuids.push(node.guid);
				leaves.push({ node, chain });
			}
			return;
		}
		kids.forEach((c) => walk(c, [...chain, node]));
	})({ children: nodes || [] }, []);

	// chain = [伪根, 真实根, ..., 父节点]；第 i 层祖先 = chain[i + 1]
	let units = null;
	for (let i = 0; ; i++) {
		const map = new Map();
		leaves.forEach(({ chain }) => {
			const a = chain[i + 1];
			if (a && !map.has(a)) map.set(a, { unit: a, parent: chain[i] || null });
		});
		if (!map.size) break;
		if (map.size >= MIN_UNITS) {
			units = [...map.values()];
			break;
		}
	}
	if (!units) units = leaves.map(({ node, chain }) => ({ unit: node, parent: chain[chain.length - 1] || null }));

	// 均匀抽样，保证设备分布覆盖整个模型
	const step = Math.max(1, Math.floor(units.length / MAX_DEVICES));
	const devices = [];
	for (let i = 0; i < units.length && devices.length < MAX_DEVICES; i += step) {
		const { unit, parent } = units[i];
		const candidates = [];
		(function collect(n) {
			const kids = n.children || [];
			if (!kids.length) {
				if (n.guid != null) candidates.push(n.guid);
				return;
			}
			kids.forEach(collect);
		})(unit);
		if (!candidates.length) continue;
		const key = String(unit.guid != null ? unit.guid : unit.name);
		const r = hash01(key + '#s');
		const last = Math.floor(hash01(key + '#d') * 120);
		devices.push({
			guid: candidates[0],
			candidates, // 部分叶子可能无几何（接管嘴等），供探针逐个试
			name: cleanName(unit.name) || '设备',
			category: cleanName(parent && parent.name) || '设备',
			status: r < 0.72 ? 0 : r < 0.9 ? 1 : 2,
			lastDate: fmtDate(last),
			nextDate: fmtDate(last + SERVICE_CYCLE)
		});
	}
	// 保证三种状态都有样本
	if (devices.length >= 3) {
		if (!devices.some((d) => d.status === 1)) devices[1].status = 1;
		if (!devices.some((d) => d.status === 2)) devices[2].status = 2;
	}
	devices.forEach((d, i) => { d.id = 'EQ-' + String(i + 1).padStart(3, '0'); });
	return { devices, allGuids };
}

// RVM 节点名带路径前缀（如 /C-106），只取最后一段
function cleanName(name) {
	return String(name || '').split('/').filter(Boolean).pop() || '';
}

// 字符串哈希到 [0,1)，同 key 恒定，换模型后仍稳定
function hash01(s) {
	let h = 0;
	for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
	return (h % 1000) / 1000;
}

function fmtDate(offsetDays) {
	const d = new Date(SERVICE_T0.getTime() + offsetDays * 864e5);
	return `${d.getMonth() + 1}月${d.getDate()}日`;
}

// 变更清单抽屉：viewer 底部覆盖层（同 03 甘特图模式），纯 DOM，不依赖引擎。
// 内部自持类型筛选；回调：onSelect(change) 点击条目
import { createList } from '../../shared/js/ui.js';
import { TYPES } from './diff-data.js';

export function createChangePanel({ onSelect }) {
	const el = document.createElement('div');
	el.className = 'change-panel';

	let filterType = -1; // -1 = 全部
	const filterBtns = [];
	const filter = document.createElement('div');
	filter.className = 'issue-filter';
	['全部', ...TYPES.map((t) => t.name)].forEach((name, i) => {
		const b = document.createElement('button');
		b.textContent = name;
		b.classList.toggle('active', i === 0);
		b.addEventListener('click', () => {
			filterType = i - 1;
			filterBtns.forEach((x, j) => x.classList.toggle('active', j === i));
			render();
		});
		filterBtns.push(b);
		filter.appendChild(b);
	});

	const toolbar = document.createElement('div');
	toolbar.className = 'change-toolbar';
	const title = document.createElement('b');
	title.textContent = '变更清单';
	const hint = document.createElement('span');
	hint.textContent = '点击条目定位构件';
	toolbar.append(title, filter, hint);
	el.appendChild(toolbar);

	const body = document.createElement('div');
	body.className = 'change-body';
	const scroll = document.createElement('div');
	scroll.className = 'change-list';
	const detailEl = document.createElement('div');
	detailEl.className = 'change-detail';
	body.append(scroll, detailEl);
	el.appendChild(body);

	let changes = [];
	let selected = null;

	function render() {
		const shown = changes.filter((c) => filterType === -1 || c.type === filterType);
		scroll.innerHTML = '';
		const ul = createList(shown, {
			render: (c) => {
				const wrap = document.createElement('div');
				const row = document.createElement('div');
				row.className = 'issue-item-title';
				// 序号圆点与模型构件着色同色，清单一眼对应模型
				const num = document.createElement('i');
				num.className = 'pin-num';
				num.style.background = TYPES[c.type].color;
				num.textContent = Number(c.id.split('-')[1]);
				const t = document.createElement('span');
				t.textContent = c.title;
				const left = document.createElement('span');
				left.className = 'pin-left';
				left.append(num, t);
				const badge = document.createElement('i');
				badge.className = 'issue-badge';
				badge.style.background = TYPES[c.type].color;
				badge.textContent = TYPES[c.type].name;
				row.append(left, badge);
				const meta = document.createElement('div');
				meta.className = 'issue-item-meta';
				meta.textContent = `${c.category} · ${c.author} · ${c.date}`;
				wrap.append(row, meta);
				return wrap;
			},
			onSelect
		});
		scroll.appendChild(ul);
		// 模型反查后同步清单激活态并滚动到可见
		if (selected && shown.includes(selected)) {
			const li = ul.children[shown.indexOf(selected)];
			if (li) {
				li.classList.add('active');
				li.scrollIntoView({ block: 'nearest' });
			}
		}
		renderDetail();
	}

	function renderDetail() {
		detailEl.innerHTML = '';
		if (!selected) return;
		const c = selected;
		const rows = [
			['构件', `${c.name}（${c.category}）`],
			['变更类型', TYPES[c.type].name],
			['提出人', c.author],
			['变更日期', c.date]
		];
		if (c.detail) rows.push([c.detail.label, `${c.detail.before} → ${c.detail.after}`]);
		detailEl.innerHTML =
			`<h3>${c.id} ${c.title}</h3>` +
			rows.map(([k, v]) => `<div class="kv"><span>${k}</span><b>${v}</b></div>`).join('') +
			`<p>${c.desc}</p>`;
	}

	return {
		el,
		// 数据 / 选中变化后重绘清单与详情
		update(list, sel) {
			changes = list;
			selected = sel;
			render();
		},
		// 模型反查的变更若被当前筛选挡住，切回「全部」
		reveal(change) {
			if (filterType === -1 || change.type === filterType) return;
			filterType = -1;
			filterBtns.forEach((x, j) => x.classList.toggle('active', j === 0));
		},
		setOpen(v) { el.classList.toggle('open', v); },
		isOpen() { return el.classList.contains('open'); }
	};
}

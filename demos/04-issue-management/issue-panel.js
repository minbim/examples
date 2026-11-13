// 问题清单抽屉：viewer 右侧覆盖层（同 03 甘特图模式），纯 DOM，不依赖引擎。
// 内部自持状态筛选；回调：onSelect(issue) 点击条目，onSetStatus(issue, status) 详情卡状态切换
import { createList } from '../../shared/js/ui.js';
import { STATUS } from './issue-data.js';

export function createIssuePanel({ onSelect, onSetStatus }) {
	const el = document.createElement('div');
	el.className = 'issue-panel';

	const toolbar = document.createElement('div');
	toolbar.className = 'issue-panel-toolbar';
	toolbar.innerHTML = '<b>问题清单</b><span>点击条目定位构件</span>';
	el.appendChild(toolbar);

	let filterStatus = -1; // -1 = 全部
	const filterBtns = [];
	const filter = document.createElement('div');
	filter.className = 'issue-filter';
	['全部', ...STATUS.map((s) => s.name)].forEach((name, i) => {
		const b = document.createElement('button');
		b.textContent = name;
		b.classList.toggle('active', i === 0);
		b.addEventListener('click', () => {
			filterStatus = i - 1;
			filterBtns.forEach((x, j) => x.classList.toggle('active', j === i));
			render();
		});
		filterBtns.push(b);
		filter.appendChild(b);
	});
	el.appendChild(filter);

	const scroll = document.createElement('div');
	scroll.className = 'issue-scroll';
	el.appendChild(scroll);

	const detailEl = document.createElement('div');
	el.appendChild(detailEl);

	let issues = [];
	let selected = null;

	function render() {
		const shown = issues.filter((it) => filterStatus === -1 || it.status === filterStatus);
		scroll.innerHTML = '';
		const ul = createList(shown, {
			render: (it) => {
				const wrap = document.createElement('div');
				const row = document.createElement('div');
				row.className = 'issue-item-title';
				// 序号圆点与场景 Marker 同数字同色，清单一眼对应模型标记
				const num = document.createElement('i');
				num.className = 'pin-num';
				num.style.background = STATUS[it.status].color;
				num.textContent = Number(it.id.split('-')[1]);
				const t = document.createElement('span');
				t.textContent = it.title;
				const left = document.createElement('span');
				left.className = 'pin-left';
				left.append(num, t);
				const badge = document.createElement('i');
				badge.className = 'issue-badge s' + it.status;
				badge.textContent = STATUS[it.status].name;
				row.append(left, badge);
				const meta = document.createElement('div');
				meta.className = 'issue-item-meta';
				meta.textContent = `${it.category} · ${it.assignee} · ${it.foundDate}`;
				wrap.append(row, meta);
				return wrap;
			},
			onSelect
		});
		scroll.appendChild(ul);
		// 反向联动/登记后同步清单激活态并滚动到可见
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
		const it = selected;
		const rows = [
			['构件', `${it.component}（${it.category}）`],
			['责任人', it.assignee],
			['优先级', it.priority],
			['发现日期', it.foundDate]
		].map(([k, v]) => `<div class="kv"><span>${k}</span><b>${v}</b></div>`).join('');
		const card = document.createElement('div');
		card.className = 'issue-detail';
		card.innerHTML = `<h3>${it.id} ${it.title}</h3>${rows}<p>${it.desc}</p>`;
		const btns = document.createElement('div');
		btns.className = 'issue-status-row';
		STATUS.forEach((s, i) => {
			const b = document.createElement('button');
			b.textContent = s.name;
			b.classList.toggle('active', it.status === i);
			b.addEventListener('click', () => onSetStatus(it, i));
			btns.appendChild(b);
		});
		card.appendChild(btns);
		detailEl.appendChild(card);
	}

	return {
		el,
		// 数据 / 选中变化后重绘清单与详情
		update(list, sel) {
			issues = list;
			selected = sel;
			render();
		},
		// 模型反查的问题若被当前筛选挡住，切回「全部」
		reveal(issue) {
			if (filterStatus === -1 || issue.status === filterStatus) return;
			filterStatus = -1;
			filterBtns.forEach((x, j) => x.classList.toggle('active', j === 0));
		},
		setOpen(v) { el.classList.toggle('open', v); },
		isOpen() { return el.classList.contains('open'); }
	};
}

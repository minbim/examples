// 进度甘特图：纯 DOM + CSS，不依赖引擎。
// 左侧任务名列 + 右侧时间条区，顶部月份刻度，琥珀色竖线为当前日期游标，
// 点击 / 拖动图表区定位日期（onSeek 回调，与主时间轴双向同步）。

const ROW_H = 26;
const HEAD_H = 28;

export function createGantt({ tasks, totalDays, startDate, onSeek }) {
	const el = document.createElement('div');
	el.className = 'gantt';

	const toolbar = document.createElement('div');
	toolbar.className = 'gantt-toolbar';
	toolbar.innerHTML = '<b>进度甘特图</b><span>点击或拖动图表区定位日期</span>';
	el.appendChild(toolbar);

	const scroll = document.createElement('div');
	scroll.className = 'gantt-scroll';
	el.appendChild(scroll);

	const cols = document.createElement('div');
	cols.className = 'gantt-cols';
	scroll.appendChild(cols);

	// 左列：任务名（行高与右侧轨道一致，保证对齐）
	const names = document.createElement('div');
	names.className = 'gantt-names';
	names.innerHTML = `<div class="gantt-names-head" style="height:${HEAD_H}px"></div>`;
	cols.appendChild(names);

	// 右列：月份刻度 + 任务条 + 日期游标
	const chart = document.createElement('div');
	chart.className = 'gantt-chart';
	cols.appendChild(chart);

	const scale = document.createElement('div');
	scale.className = 'gantt-scale';
	scale.style.height = HEAD_H + 'px';
	monthTicks(startDate, totalDays).forEach(({ label, day }) => {
		const tick = document.createElement('i');
		tick.style.left = (day / totalDays) * 100 + '%';
		tick.textContent = label;
		scale.appendChild(tick);
	});
	chart.appendChild(scale);

	const bars = [];
	tasks.forEach((t) => {
		const name = document.createElement('div');
		name.className = 'gantt-name';
		name.style.height = ROW_H + 'px';
		name.textContent = t.name;
		name.title = t.name;
		names.appendChild(name);

		const track = document.createElement('div');
		track.className = 'gantt-track';
		track.style.height = ROW_H + 'px';
		const bar = document.createElement('div');
		bar.className = 'gantt-bar';
		bar.style.left = (t.start / totalDays) * 100 + '%';
		bar.style.width = ((t.end - t.start) / totalDays) * 100 + '%';
		const fill = document.createElement('div');
		fill.className = 'gantt-bar-fill';
		bar.appendChild(fill);
		track.appendChild(bar);
		chart.appendChild(track);
		bars.push({ t, bar, fill });
	});

	// 日期游标（含顶部抓手与日期标签）
	const cursor = document.createElement('div');
	cursor.className = 'gantt-cursor';
	const cursorLabel = document.createElement('span');
	cursorLabel.className = 'gantt-cursor-label';
	cursor.appendChild(cursorLabel);
	chart.appendChild(cursor);

	// 点击 / 拖动定位日期
	let dragging = false;
	const seek = (e) => {
		const rect = chart.getBoundingClientRect();
		const day = Math.round(((e.clientX - rect.left) / rect.width) * totalDays);
		onSeek(Math.max(0, Math.min(totalDays, day)));
	};
	chart.addEventListener('pointerdown', (e) => {
		dragging = true;
		chart.setPointerCapture(e.pointerId);
		seek(e);
	});
	chart.addEventListener('pointermove', (e) => { if (dragging) seek(e); });
	chart.addEventListener('pointerup', () => { dragging = false; });

	function setDate(day) {
		cursor.style.left = (day / totalDays) * 100 + '%';
		const d = new Date(startDate.getTime() + day * 864e5);
		cursorLabel.textContent = `${d.getMonth() + 1}/${d.getDate()}`;
		bars.forEach(({ t, bar, fill }) => {
			const p = Math.max(0, Math.min(1, (day - t.start) / (t.end - t.start)));
			fill.style.width = p * 100 + '%';
			bar.classList.toggle('done', p >= 1);
			bar.classList.toggle('doing', p > 0 && p < 1);
		});
	}

	function toggle() {
		el.classList.toggle('open');
	}

	return { el, setDate, toggle };
}

// 工期范围内每月 1 日的刻度（首月从起始日开始）
function monthTicks(startDate, totalDays) {
	const ticks = [];
	const end = startDate.getTime() + totalDays * 864e5;
	const d = new Date(startDate.getTime());
	d.setDate(1);
	if (d.getTime() < startDate.getTime()) d.setMonth(d.getMonth() + 1);
	while (d.getTime() <= end) {
		ticks.push({
			label: `${d.getMonth() + 1}月`,
			day: Math.round((d.getTime() - startDate.getTime()) / 864e5)
		});
		d.setMonth(d.getMonth() + 1);
	}
	return ticks;
}

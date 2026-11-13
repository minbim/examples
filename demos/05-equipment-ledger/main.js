// 05 · 设备台账与运维管理
// API 以 https://www.minbim.com/docs.html 为准
// 文件分工：main.js=引擎 API 主线；equip-data.js=演示台账数据
import { assetUrl } from '../../shared/js/paths.js';
import { createStats } from '../../shared/js/ui.js';
import { STATUS, deriveDevices } from './equip-data.js';

const MODEL_DIR = 'models/chemical-equipment';
const FAULT_OPACITY = 0.02; // 「只看异常设备」时其他构件的半透明度

let viewer = null;
let marker = null;
let popup = null;

let devices = [];
let allGuids = [];
let faultOnly = false;

let statsCells = [];
let faultBtn = null;

export async function mount(container, panel) {
	viewer = new MinBIM.Viewer(container.id);
	viewer.init({
		config: { assetsDir: assetUrl('assets') },
		background: 'transparent'
	});
	viewer.renderRequested = true;
	marker = new MinBIM.Widget.Marker(viewer);
	popup = new MinBIM.Widget.Popup(viewer);
	// 弹框关闭按钮联动取消构件选中
	popup.addEventListener('close', () => viewer.picker.clearSelection());
	marker.addEventListener('click', (e) => {
		const hit = devices.find((d) => d.id === e.id);
		if (hit) selectDevice(hit);
	});

	const loader = new MinBIM.Loader(viewer, true);
	const model = await loader.load(assetUrl(MODEL_DIR));
	({ devices, allGuids } = deriveDevices(loader.getNode()));
	viewer.focus(model);

	// 探针剔除无几何候选（如接管嘴），再重编号并重建标记
	devices = devices.filter((d) => probeAnchor(d));
	devices.forEach((d, i) => { d.id = 'EQ-' + String(i + 1).padStart(3, '0'); });
	marker.clear();
	devices.forEach((d) => addPin(d));

	buildPanel(panel);
	updateStats();

	// 点构件反查台账
	viewer.picker.addEventListener('selected', (e) => {
		const hit = devices.find((d) => d.guid === String(e.id));
		if (hit) selectDevice(hit, true);
	});
	viewer.picker.addEventListener('deselect', () => popup.close());
	viewer.picker.addEventListener('unselected', () => popup.close());
}

// 锚点探针：候选构件逐个试加，记下首个有效锚点
function probeAnchor(device) {
	for (const guid of device.candidates) {
		if (marker.add({ id: device.id, guid, color: STATUS[device.status].color }) !== null) {
			device.guid = guid;
			return true;
		}
	}
	return false;
}

// 状态标记：锚定设备包围盒中心，颜色与状态同色，文字为设备序号
function addPin(device) {
	return marker.add({
		id: device.id,
		guid: device.guid,
		color: STATUS[device.status].color,
		text: String(Number(device.id.split('-')[1]))
	});
}

// 选中设备（标记 / 模型反查共用）：高亮定位 + 标记旁弹出维保信息
function selectDevice(device, fromModel = false) {
	if (!fromModel) viewer.picker.setSelected([device.guid]);
	popup.open({
		guid: device.guid,
		title: `${device.id} ${device.name}`,
		content: buildCard(device)
	});
}

// 弹框内容：台账字段 + 异常设备的「完成维保」按钮
function buildCard(d) {
	const card = document.createElement('div');
	card.className = 'equip-card';
	const rows = [
		['设备编号', d.id],
		['类别', d.category],
		['运行状态', `<i class="equip-dot" style="background:${STATUS[d.status].color}"></i>${STATUS[d.status].name}`],
		['最近维保', d.lastDate],
		['下次维保', d.nextDate]
	];
	card.innerHTML = rows.map(([k, v]) => `<div class="kv"><span>${k}</span><b>${v}</b></div>`).join('');
	if (d.status !== 0) {
		const btn = document.createElement('button');
		btn.className = 'equip-repair';
		btn.textContent = '完成维保';
		btn.addEventListener('click', () => repairDevice(d));
		card.appendChild(btn);
	}
	return card;
}

// 完成维保：状态回到运行正常，标记换色，弹框内容刷新
function repairDevice(device) {
	device.status = 0;
	marker.setColor(device.id, STATUS[0].color);
	popup.updateContent(buildCard(device));
	if (faultOnly) applyFaultOnly(); // 凸显集合随状态重算
	updateStats();
}

// 「只看异常设备」：异常设备保持实体，其余构件半透明
function applyFaultOnly() {
	viewer.display.showAll();
	if (faultOnly) {
		const faultGuids = new Set(devices.filter((d) => d.status !== 0).map((d) => d.guid));
		viewer.display.setTransparent(allGuids.filter((g) => !faultGuids.has(g)), FAULT_OPACITY);
	}
	faultBtn.textContent = faultOnly ? '显示全部构件' : '只看异常设备';
	faultBtn.classList.toggle('armed', faultOnly);
}

function buildPanel(panel) {
	const ops = document.createElement('div');
	ops.className = 'action-group';
	ops.innerHTML = '<h2>设备管理</h2>';
	panel.appendChild(ops);

	faultBtn = document.createElement('button');
	faultBtn.className = 'action-btn';
	faultBtn.textContent = '只看异常设备';
	faultBtn.addEventListener('click', () => {
		faultOnly = !faultOnly;
		applyFaultOnly();
	});
	ops.appendChild(faultBtn);

	const statsGroup = document.createElement('div');
	statsGroup.className = 'action-group';
	statsGroup.innerHTML = '<h2>设备统计</h2>';
	panel.appendChild(statsGroup);
	statsCells = [];
	const el = createStats([
		{ label: '设备总数', value: 0 },
		{ label: '运行正常', value: 0 },
		{ label: '待维保', value: 0 },
		{ label: '故障', value: 0 }
	], { columns: 2 });
	el.querySelectorAll('.ui-stat b').forEach((b) => statsCells.push(b));
	statsGroup.appendChild(el);
}

function updateStats() {
	const counts = [0, 0, 0];
	devices.forEach((d) => counts[d.status]++);
	statsCells[0].textContent = devices.length;
	statsCells[1].textContent = counts[0];
	statsCells[2].textContent = counts[1];
	statsCells[3].textContent = counts[2];
}

// 沙箱切换示例时调用，必须 dispose viewer，否则 WebGL 上下文耗尽
export function destroy() {
	if (popup) popup.dispose();
	if (marker) marker.dispose();
	if (viewer) viewer.dispose();
	viewer = null;
	marker = null;
	popup = null;
	devices = [];
	allGuids = [];
	faultOnly = false;
	statsCells = [];
	faultBtn = null;
}

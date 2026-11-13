// API 以 https://www.minbim.com/docs.html 为准
import { assetUrl } from '../../shared/js/paths.js';

// 天地图 tk（浏览器端类型，申请：https://console.tianditu.gov.cn/，发布前请替换为自己的 key）
const TK = '';
const tdt = (layer) => `https://t0.tianditu.gov.cn/DataServer?T=${layer}&x={x}&y={y}&l={z}&tk=${TK}`;

// 场地位置：倾斜摄影锚点，BIM 模型落在其附近
const OSGB_SITE = [117.125591, 36.707154];
const BIM_SITE = [117.1262, 36.7063];

let viewer = null;
let gis = null;

export async function mount(container, panel) {
	viewer = new MinBIM.Viewer(container.id);
	viewer.init({
		quality: false,
		ground: false,
		toolbar: false,
		tree: false,
		viewCube: false,
		background: '#0b1c2c',
		config: { assetsDir: assetUrl('assets') }
	});

	// GIS 扩展（带地球过场）
	gis = MinBIMGIS.attach(viewer, { intro: true, navigation: true });
	gis.setOrigin(117.12, 36.65);

	// 天地图卫星影像（直连天地图，无需本地瓦片服务）；tk 未配置时跳过并提示
	if (TK) {
		gis.addLayer(new MinBIMGIS.TileLayer({
			imagery: [
				{ index: 0, url: tdt('img_w'), minZoom: 3, maxZoom: 18 }
			]
		}));
	} else {
		const tip = document.createElement('p');
		tip.style.cssText = 'font-size:12px;color:#d99a17;line-height:1.6;margin:8px 0;';
		tip.textContent = '天地图 tk 未配置，卫星影像未加载。请在本文件顶部 TK 填入自己的浏览器端 key（申请：https://console.tianditu.gov.cn/）。';
		panel.appendChild(tip);
	}

	// 倾斜摄影 3DTiles 模型（osgb 转换成果）
	gis.addLayer(new MinBIMGIS.Tiles3DLayer({
		url: assetUrl('models/3dtiles/osgb/tileset.json'),
		lonLatAlt: [OSGB_SITE[0], OSGB_SITE[1], 13],
		rotation: [0, 0, -53],
	}));

	// 经纬度/高程读数挂件（跟随鼠标）
	new MinBIMGIS.CoordWidget(viewer, gis);

	// BIM 模型落在场地附近：经纬度经 gis.lonLatToLocal 换算为场景坐标
	const loader = new MinBIM.Loader(viewer);
	const bim = await loader.load(assetUrl('models/sample-bim'));
	const p = gis.lonLatToLocal(BIM_SITE[0], BIM_SITE[1], 0);
	bim.position.set(p.x, p.y, p.z);

	window.demo = {
		// 飞到场地俯视 BIM + 倾斜摄影
		flyToSite() {
			gis.flyTo((OSGB_SITE[0] + BIM_SITE[0]) / 2, (OSGB_SITE[1] + BIM_SITE[1]) / 2, 0, { height: 50, pitch: 25 });
		},
	};
}

// 契约：切换示例时沙箱会调用，必须 dispose viewer，否则 WebGL 上下文耗尽
export function destroy() {
	if (viewer) viewer.dispose();
	viewer = null;
	gis = null;
}

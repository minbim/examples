// API 以 https://www.minbim.com/docs.html 为准
import { assetUrl } from '../../shared/js/paths.js';

let viewer = null;
let model = null;

// 加载后落位的固定视角
const HOME_VIEW = {
	position: { x: 19.159472754722984, y: 22.89905812703465, z: -54.88725353541651 },
	target: { x: 63.33931862176229, y: 13.375827236121268, z: -44.242599289431844 }
};

export async function mount(container) {
	viewer = new MinBIM.Viewer(container.id);
	viewer.init({
		config: { assetsDir: assetUrl('assets') },
		background: 'transparent'
	});
	viewer.renderRequested = true;

	window.demo = {
		async loadModel() {
			if (!model) model = await new MinBIM.Loader(viewer).load(assetUrl('models/sample-bim'));
			viewer.restoreView(HOME_VIEW);
		},
	};
}

// 沙箱切换示例时调用，必须 dispose viewer，否则 WebGL 上下文耗尽
export function destroy() {
	if (viewer) viewer.dispose();
	viewer = null;
	model = null;
}

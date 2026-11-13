// API 以 minbim-2d《MinBIM CAD 接口文档》为准（UMD 全局 MinBIMCAD）
import { assetUrl } from '../../shared/js/paths.js';

let viewer = null;
let loaded = false;

export async function mount(container) {
	viewer = new MinBIMCAD.Viewer(container.id);
	viewer.init({
		config: { assetsDir: assetUrl('assets') }
	});

	window.demo = {
		async loadDrawing() {
			if (loaded) return;
			loaded = true;
			await viewer.load(assetUrl('models/sample-cad/manifest.json'));
		},
	};
}

// 契约：切换示例时沙箱会调用，必须 dispose viewer，否则 WebGL 上下文耗尽
export function destroy() {
	if (viewer) viewer.dispose();
	viewer = null;
	loaded = false;
}

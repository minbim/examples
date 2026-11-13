export const demos = [
  {
    id: '01-basic-viewer',
    title: '01 · BIM 模型加载',
    desc: '初始化 Viewer，加载 BIM 模型并定位视角。',
    domain: 'bim',
    group: 'BIM 基础功能',
    module: () => import('../../demos/01-basic-viewer/main.js'),
    sourcePath: 'demos/01-basic-viewer/main.js',
    thumb: new URL('../../demos/01-basic-viewer/thumb.jpg', import.meta.url).href,
    actions: [
      { label: '加载模型', action: 'loadModel' }
    ]
  },
  {
    id: '02-multi-discipline',
    title: '02 · 多专业模型协同查看',
    desc: '按专业勾选加载建筑 / 结构 / 机电模型，独立显隐，结构树与属性跨模型合并。',
    domain: 'bim',
    group: 'BIM 业务场景',
    module: () => import('../../demos/02-multi-discipline/main.js'),
    sourcePath: 'demos/02-multi-discipline/main.js',
    thumb: new URL('../../demos/02-multi-discipline/thumb.jpg', import.meta.url).href,
    actions: []
  },
  {
    id: '03-progress-simulation',
    title: '03 · 施工进度模拟',
    desc: '拖动时间轴或播放，构件按计划呈现 已完成 / 施工中 / 未开始 三态，附进度甘特图与统计。',
    domain: 'bim',
    group: 'BIM 业务场景',
    module: () => import('../../demos/03-progress-simulation/main.js'),
    sourcePath: 'demos/03-progress-simulation/main.js',
    thumb: new URL('../../demos/03-progress-simulation/thumb.jpg', import.meta.url).href,
    actions: []
  },
  {
    id: '04-issue-management',
    title: '04 · BIM 构件问题与整改管理',
    desc: '问题清单与构件双向定位，待整改 / 整改中 / 已整改状态流转，支持点击构件登记新问题。',
    domain: 'bim',
    group: 'BIM 业务场景',
    module: () => import('../../demos/04-issue-management/main.js'),
    sourcePath: 'demos/04-issue-management/main.js',
    thumb: new URL('../../demos/04-issue-management/thumb.jpg', import.meta.url).href,
    actions: []
  },
  {
    id: '05-equipment-ledger',
    title: '05 · 设备台账与运维管理',
    desc: '点击模型上的设备标记弹出维保信息，运行状态同色标记，异常设备一键隔离凸显。',
    domain: 'bim',
    group: 'BIM 业务场景',
    module: () => import('../../demos/05-equipment-ledger/main.js'),
    sourcePath: 'demos/05-equipment-ledger/main.js',
    thumb: new URL('../../demos/05-equipment-ledger/thumb.jpg', import.meta.url).href,
    actions: []
  },
  {
    id: '06-version-compare',
    title: '06 · 设计变更与版本对比',
    desc: '双视图联动对比新旧版本模型，新增 / 删除 / 修改构件三色着色，变更清单双向定位。',
    domain: 'bim',
    group: 'BIM 业务场景',
    module: () => import('../../demos/06-version-compare/main.js'),
    sourcePath: 'demos/06-version-compare/main.js',
    thumb: new URL('../../demos/06-version-compare/thumb.jpg', import.meta.url).href,
    actions: []
  },
  {
    id: '07-bim-gis',
    title: '07 · BIM 场地与 GIS 协同',
    desc: '天地图卫星影像 + 倾斜摄影 3DTiles + BIM 模型同场景呈现，BIM 模型按经纬度落位到场地。',
    domain: 'gis',
    group: 'GIS 协同',
    module: () => import('../../demos/07-bim-gis/main.js'),
    sourcePath: 'demos/07-bim-gis/main.js',
    thumb: new URL('../../demos/07-bim-gis/thumb.jpg', import.meta.url).href,
    actions: [
      { label: '飞到场地', action: 'flyToSite' }
    ]
  },
  {
    id: '08-cad-viewer',
    title: '08 · CAD 图纸加载',
    desc: '初始化 minbim-2d 图纸查看器，加载 DWG 转换产物，内置图层 / 测量 / 查找 / 区域放大工具。',
    domain: 'cad',
    group: 'CAD 图纸',
    module: () => import('../../demos/08-cad-viewer/main.js'),
    sourcePath: 'demos/08-cad-viewer/main.js',
    thumb: new URL('../../demos/08-cad-viewer/thumb.jpg', import.meta.url).href,
    actions: [
      { label: '加载图纸', action: 'loadDrawing' }
    ]
  },
  {
    id: '09-bim-cad-link',
    title: '09 · 图模联动',
    desc: '三维模型与 CAD 图纸两点配准（定位 + 比例），双向同步视窗区域，图纸随模型视角联动。',
    domain: 'cad',
    group: 'CAD 图纸',
    module: () => import('../../demos/09-bim-cad-link/main.js'),
    sourcePath: 'demos/09-bim-cad-link/main.js',
    thumb: new URL('../../demos/09-bim-cad-link/thumb.jpg', import.meta.url).href,
    actions: []
  }
];
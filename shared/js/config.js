// 部署配置：发布平台相关的可选项集中在这里，切换平台只改本文件
export const deploy = {
  // 'github' | 'gitee' —— 决定「查看源码」链接指向哪个平台的仓库
  platform: 'github',
  // 各平台仓库的源码浏览前缀（需以 / 结尾，后面拼 demo.sourcePath）
  repos: {
    github: 'https://github.com/minbim/examples/blob/master/',
    gitee: 'https://gitee.com/minbim/examples/blob/master/'
  }
};

export function sourceUrl(demo) {
  return deploy.repos[deploy.platform] + demo.sourcePath;
}

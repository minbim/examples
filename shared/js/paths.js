// 资源路径统一入口。base 为相对路径（'./'），本地开发与 Pages 子路径部署通用。
// demo 内引用模型 / 引擎资源一律走这里，禁止写 '/' 开头的绝对路径。
const BASE = import.meta.env.BASE_URL.replace(/\/?$/, '/');

export function assetUrl(path) {
  return BASE + path.replace(/^\//, '');
}

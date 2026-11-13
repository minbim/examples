// 业务面板通用小组件：保持无框架、纯 DOM，示例代码让人一眼看懂。
// 返回的都是 DOM 元素，由 demo 自行 append 到面板容器。
// 体量更大的组件（如甘特图）不走这里，用弹窗或独立面板承载。

// 可选列表（问题清单、设备台账等）
// items: 任意数组；render(item) 返回标题字符串或 DOM；onSelect(item, el) 点击回调
export function createList(items, { render, onSelect } = {}) {
  const ul = document.createElement('ul');
  ul.className = 'ui-list';
  items.forEach((item) => {
    const li = document.createElement('li');
    li.className = 'ui-list-item';
    const content = render ? render(item) : String(item);
    if (content instanceof Node) li.appendChild(content);
    else li.textContent = content;
    if (onSelect) {
      li.addEventListener('click', () => {
        ul.querySelectorAll('.active').forEach((el) => el.classList.remove('active'));
        li.classList.add('active');
        onSelect(item, li);
      });
    }
    ul.appendChild(li);
  });
  return ul;
}

// 滑块（时间轴、水位等）
// onInput(value) 拖动时回调；返回元素带 .input / .valueEl 便于外部读写
export function createSlider({ label, min = 0, max = 100, step = 1, value = min, onInput } = {}) {
  const wrap = document.createElement('div');
  wrap.className = 'ui-slider';
  const input = document.createElement('input');
  input.type = 'range';
  Object.assign(input, { min, max, step, value });
  const head = document.createElement('div');
  head.className = 'ui-slider-head';
  const labelEl = document.createElement('span');
  labelEl.textContent = label || '';
  const valueEl = document.createElement('span');
  valueEl.className = 'ui-slider-value';
  valueEl.textContent = value;
  head.append(labelEl, valueEl);
  input.addEventListener('input', () => {
    valueEl.textContent = input.value;
    onInput?.(Number(input.value));
  });
  wrap.append(head, input);
  wrap.input = input;
  wrap.valueEl = valueEl;
  return wrap;
}

// 统计数字块（进度统计、问题状态计数等）
// entries: [{ label, value }]；columns 指定列数（如 2 时三个块呈 2+1 两行），缺省自适应
export function createStats(entries, { columns } = {}) {
  const grid = document.createElement('div');
  grid.className = 'ui-stats';
  if (columns) grid.style.gridTemplateColumns = `repeat(${columns}, 1fr)`;
  entries.forEach(({ label, value }) => {
    const cell = document.createElement('div');
    cell.className = 'ui-stat';
    const v = document.createElement('b');
    v.textContent = value;
    const l = document.createElement('span');
    l.textContent = label;
    cell.append(v, l);
    grid.appendChild(cell);
  });
  return grid;
}

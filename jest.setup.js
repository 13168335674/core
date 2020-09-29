const { JSDOM } = require('jsdom');
const { join } = require('path');

const jsdom = new JSDOM(`<div id="main"></div>`, {
  // https://github.com/jsdom/jsdom#basic-options
  // 禁用掉 resources: usable, 采用 jsdom 默认策略不加载 subresources
  // 避免测试用例加载 external subresource, 如 iconfont 的 css 挂掉
  // resources: 'usable',
  runScripts: 'dangerously',
  url: 'http://localhost/?id=1',
});
global.document = jsdom.window.document;
global.navigator = jsdom.window.navigator;
global.Element = jsdom.window.Element;
global.HTMLDivElement = jsdom.window.HTMLDivElement;
global.fetch = jsdom.window.fetch;
global.location = jsdom.window.location;
global.getComputedStyle = jsdom.window.getComputedStyle;
global.window = jsdom.window;
global.DOMParser = jsdom.window.DOMParser;
global.HTMLDivElement = jsdom.window.HTMLDivElement;
global.MutationObserver = jsdom.window.MutationObserver;
global.requestAnimationFrame = fn => setTimeout(fn, 16);
jsdom.window.requestAnimationFrame = fn => setTimeout(fn, 16);
jsdom.window.cancelAnimationFrame = () => { };

jest.mock(join(__dirname, 'packages/monaco/src/browser/monaco-loader'));

/* istanbul ignore file */
const { ipcRenderer } = require('electron');

const argv = process.argv;

let parentWindowWebContentsId;
let additionalEnv;

argv.forEach((arg) => {
  if ( arg.indexOf('--parentWindowWebContentsId=') === 0 ) {
    parentWindowWebContentsId = parseInt(arg.substr('--parentWindowWebContentsId='.length), 10);
  }
  if ( arg.indexOf('--additionalEnv=') === 0 ) {
    additionalEnv = JSON.parse(arg.substr('--additionalEnv='.length))
  }
})
let postMessage = undefined;

if (parentWindowWebContentsId) {
  let currentWindowId = require('electron').remote.getCurrentWindow().id;
  postMessage = (message) => {
    ipcRenderer.sendTo(parentWindowWebContentsId, 'cross-window-webview-message', {
      from: currentWindowId,
      message
    });
  }
} else {
  postMessage = (message) => {
    ipcRenderer.sendToHost('webview-message', message);
  }
}

if (additionalEnv) {
  window.env = Object.assign({}, additionalEnv);
}

const parent = window.parent;

window.parent = new Proxy(window.parent, {
  get: (target,p) => {
    if(p === 'postMessage') {
      return postMessage;
    } else {
      return Reflect.get(target, p);
    }
  }
})

ipcRenderer.on('webview-message', (e, data) => {
  const messageEvent = new MessageEvent('message', { data:data, source: parent});
  window.dispatchEvent(messageEvent);
})
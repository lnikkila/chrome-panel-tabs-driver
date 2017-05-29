document.addEventListener('DOMContentLoaded', initialize);

const MOBILE_USER_AGENT = 'Mozilla/5.0 (Linux; Android 5.1.1; Nexus 5 ' +
  'Build/LMY48B; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 ' +
  'Chrome/43.0.2357.65 Mobile Safari/537.36';

const move = new Event('panelmove');
const positionChange = new Event('panelpositionchange');

var state = 'docked';

var title;
var spinner;
var favicon;
var webView;
var closeButton;
var collapseButton;

var isMoving = false;

function initialize() {
  title = document.querySelector('.title');
  spinner = document.querySelector('.spinner');
  favicon = document.querySelector('.favicon');
  webView = document.querySelector('webview');
  closeButton = document.querySelector('.controls .close');
  collapseButton = document.querySelector('.controls .collapse');

  setupWebView();
  setupContextMenu();
  setupPage();

  // Inform the background script that we're initialised. It has created this
  // function for us beforehand.
  onInitialized(window);

  var titleBar = document.querySelector('.title-bar');

  titleBar.addEventListener('mousedown', function(e) {
    isMoving = true;
  });

  titleBar.addEventListener('mousemove', function(e) {
    if (isMoving) {
      window.dispatchEvent(move);
    }
  });

  titleBar.addEventListener('mouseup', function(e) {
    if (isMoving) {
      window.dispatchEvent(positionChange);
    }

    isMoving = false;
  });
}

function setupWebView() {
  webView.addEventListener('loadstart', function() {
    delete spinner.dataset.offCanvas;
  });

  webView.addEventListener('loadstop', function() {
    spinner.dataset.offCanvas = '';
  });

  webView.addEventListener('contentload', function() {
    webView.executeScript({ code: 'document.title' }, function(pageTitle) {
      title.innerText = pageTitle;
    });
  });

  webView.addEventListener('newwindow', function(e) {
    chrome.browser.openTab({ url: e.targetUrl });
  });

  webView.addEventListener('close', close);

  webView.addEventListener('permissionrequest', function(e) {
    switch (e.permission) {
      case 'download':
      case 'fullscreen':
        return e.request.allow();
    }
  });
}

function setupContextMenu() {
  webView.contextMenus.onShow.addListener(updateContextMenu);

  webView.contextMenus.create({ id: 'back',    title: 'Back',    onclick: goBack });
  webView.contextMenus.create({ id: 'forward', title: 'Forward', onclick: goForward });
  webView.contextMenus.create({ id: 'reload',  title: 'Reload',  onclick: reload });

  webView.contextMenus.create({ type: 'separator' });

  webView.contextMenus.create({ id: 'showSource', title: 'View Page Source', onclick: showSource });
}

function updateContextMenu() {
  webView.contextMenus.update('back',    { enabled: webView.canGoBack() });
  webView.contextMenus.update('forward', { enabled: webView.canGoForward() });
}

function setupPage() {
  closeButton.addEventListener('click', close);

  collapseButton.addEventListener('click', function() {
    if (state === 'collapsed') {
      setState('docked');
    } else {
      setState('collapsed');
    }
  });
}

function navigate(url) {
  webView.src = url;
}

function goBack() {
  webView.back();
}

function goForward() {
  webView.forward();
}

function reload() {
  webView.reload();
}

function showSource() {
  chrome.browser.openTab({ url: 'view-source:' + webView.src });
}

function close() {
  chrome.app.window.current().close();
}

function setMobile(isMobile) {
  if (isMobile) {
    webView.setUserAgentOverride(MOBILE_USER_AGENT);
  } else {
    // Undocumented, but resets the user agent.
    webView.setUserAgentOverride('');
  }
}

function setState(newState) {
  switch (newState) {
    case 'detached':
    case 'docked':
      expand();
      break;

    case 'collapsed':
      collapse();
      break;
  }

  state = newState;
}

function expand() {
  var currentWindow = chrome.app.window.current();
  var bounds = currentWindow.outerBounds;

  var oldHeight = bounds.height;
  var newHeight = 400; // TODO: Use persisted value.

  bounds.minHeight = 400;
  bounds.maxHeight = null;

  bounds.height = newHeight;

  // Shift the window up.
  bounds.top += oldHeight - newHeight;

  // Change controls.
  collapseButton.classList.add('collapse');
  collapseButton.classList.remove('expand');

  // We need to wait for the bounds to be applied before changing them further.
  currentWindow.onBoundsChanged.addListener(function listener() {
    currentWindow.onBoundsChanged.removeListener(listener);
    setResizable(true);
  });
}

function collapse() {
  var currentWindow = chrome.app.window.current();
  var bounds = currentWindow.innerBounds;

  var titleBar = document.querySelector('.title-bar');

  var oldHeight = bounds.height;
  var newHeight = titleBar.offsetHeight;

  // Reset minimum and maximum height so we can resize properly.
  bounds.minHeight = null;
  bounds.maxHeight = null;

  bounds.height = newHeight;

  // Shift the window down.
  bounds.top += oldHeight - newHeight;

  // Change controls.
  collapseButton.classList.remove('collapse');
  collapseButton.classList.add('expand');

  // We need to wait for the bounds to be applied before changing them further.
  currentWindow.onBoundsChanged.addListener(function listener() {
    currentWindow.onBoundsChanged.removeListener(listener);
    setResizable(false);
  });
}

function setDraggable(isDraggable) {
  var titleBar = document.querySelector('.title-bar');
  var currentWindow = chrome.app.window.current();

  if (isDraggable) {
    titleBar.style['-webkit-app-region'] = 'drag';
  } else {
    titleBar.style['-webkit-app-region'] = 'no-drag';
  }

  // HACK: Forcing a reflow to make the change effective.
  titleBar.style.display = 'none';
  titleBar.offsetHeight;
  titleBar.style.display = '';
}

function setResizable(isResizable) {
  var currentWindow = chrome.app.window.current();
  var bounds = currentWindow.outerBounds;

  var minWidth  = (isResizable ? null : bounds.width);
  var minHeight = (isResizable ? null : bounds.height);

  var maxWidth  = (isResizable ? null : bounds.width);
  var maxHeight = (isResizable ? null : bounds.height);

  bounds.setMinimumSize(minWidth, minHeight);
  bounds.setMaximumSize(maxWidth, maxHeight);
}

const MARGIN = 24;

var osType;

chrome.app.runtime.onLaunched.addListener(function() {
  chrome.runtime.getPlatformInfo(function(info) {
    osType = info.os;
    createPanel('https://google.com');
  });
});

chrome.runtime.onMessageExternal.addListener(receiveExternalMessage);

/**
 * Receives a message from an external script.
 *
 * @param  {object}        message  Object with a mandatory type property.
 * @param  {MessageSender} sender   Information about the sender.
 * @param  {Function}      callback (Optional.) Parameters are specific to the
 *                                  type of the message object.
 * @return {boolean} Whether the callback will be called afterwards.
 * @see    https://developer.chrome.com/apps/runtime#event-onMessageExternal
 */
function receiveExternalMessage(message, sender, callback) {
  switch (message.type) {
    case 'open':
      createPanel(message.url);
      return false;
    case 'close':
      return false;
    case 'query':
      return true;
  }
}

function createPanel(url) {
  var width = 500;
  var height = 400;
  var minWidth = 200;
  var minHeight = 200;

  chrome.app.window.create('/html/panel.html', {
    alwaysOnTop: true,
    frame: 'none',
    hidden: true,
    innerBounds: {
      width: width,
      height: height,
      minWidth: minWidth,
      minHeight: minHeight
    },
    visibleOnAllWorkspaces: true
  }, function(panel) {
    panel.contentWindow.onInitialized = function(contentWindow) {
      contentWindow.navigate(url);
    };

    panel.contentWindow.addEventListener('panelmove', function() {
      touchWindows(panel);
    });

    panel.contentWindow.addEventListener('panelpositionchange', function() {
      touchWindows();
    });

    touchWindows(null, function() {
      panel.show();
    });
  });
}

function touchWindows(movingPanel, callback) {
  const MARGIN = 10;

  var panels = chrome.app.window.getAll();
  var endDistance = screen.width;

  _(panels)
    .sortBy(function(panel) {
      return panel.outerBounds.left;
    })
    .reverse()
    .forEach(function(panel) {
      var width  = panel.outerBounds.width;
      var height = panel.innerBounds.height;

      endDistance -= (MARGIN + width);

      if (panel === movingPanel) {
        return;
      }

      var left = endDistance;
      var top  = screen.availTop + screen.availHeight - height;

      // screen.availHeight doesn't reach the bottom of the screen on OS X due
      // to the dock.
      if (osType === 'mac') {
        top = screen.height - height;
      }

      // Atomic unlike setting left and top separately.
      panel.outerBounds.setPosition(left, top);

      if (callback) {
        callback();
      }
    })
    .value();
}

function snapToEdge(panel) {
  const SNAP_THRESHOLD = 32;

  // Y-coordinate for the bottom edge of the available window area.
  var windowAreaBottom = screen.availTop + screen.availHeight;

  var bounds = panel.outerBounds;
  var bottomDistance = windowAreaBottom - (bounds.top + bounds.height);

  if (Math.abs(bottomDistance) < SNAP_THRESHOLD && bottomDistance !== 0) {
    bounds.top = windowAreaBottom - bounds.height;
  }
}

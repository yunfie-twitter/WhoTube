(function() {
  /**
   * WhoTube Iframe Player API
   * YouTube IFrame API と同等の機能を提供します。
   */
  var WhoTube = window.WhoTube || {};
  
  // プレーヤーの状態定数
  WhoTube.PlayerState = {
    UNSTARTED: -1,
    ENDED: 0,
    PLAYING: 1,
    PAUSED: 2,
    BUFFERING: 3,
    CUED: 5
  };

  /**
   * Player クラス
   * @param {string|HTMLElement} elementId 置換対象のエレメントIDまたは要素
   * @param {Object} options オプション (videoId, width, height, playerVars, events)
   */
  WhoTube.Player = function(elementId, options) {
    this.elementId = elementId;
    this.options = options || {};
    this.iframe = null;
    this.widgetId = options.widgetid || Math.floor(Math.random() * 1000000);
    this.currentState = WhoTube.PlayerState.UNSTARTED;
    this.init();
  };

  WhoTube.Player.prototype.init = function() {
    var element = typeof this.elementId === 'string' 
      ? document.getElementById(this.elementId) 
      : this.elementId;
      
    if (!element) {
      console.error('WhoTube Player: Element not found:', this.elementId);
      return;
    }

    var videoId = this.options.videoId;
    var width = this.options.width || 640;
    var height = this.options.height || 360;
    var playerVars = this.options.playerVars || {};
    
    // APIを有効化するためのフラグ
    playerVars.enablejsapi = 1;
    playerVars.widgetid = this.widgetId;
    
    // オリジン情報 (セキュリティ用)
    var origin = window.location.origin;
    playerVars.origin = origin;

    var queryStr = this.serialize(playerVars);
    var src = "/embed/" + videoId + (queryStr ? "?" + queryStr : "");
    
    var iframe = document.createElement('iframe');
    iframe.id = typeof this.elementId === 'string' ? this.elementId : "whotube-player-" + this.widgetId;
    iframe.width = width;
    iframe.height = height;
    iframe.src = src;
    iframe.frameBorder = "0";
    iframe.style.border = "none";
    iframe.allow = "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share";
    iframe.allowFullscreen = true;
    
    if (element.parentNode) {
      element.parentNode.replaceChild(iframe, element);
    }
    this.iframe = iframe;

    // メッセージリスナーの登録
    window.addEventListener('message', this.handleMessage.bind(this));
  };

  WhoTube.Player.prototype.serialize = function(obj) {
    var str = [];
    for (var p in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, p)) {
        str.push(encodeURIComponent(p) + "=" + encodeURIComponent(obj[p]));
      }
    }
    return str.join("&");
  };

  WhoTube.Player.prototype.handleMessage = function(event) {
    var data;
    try {
      data = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
    } catch(e) { 
      return; 
    }

    // widgetid が一致する場合のみ処理
    if (data.id != this.widgetId) return;

    if (data.event === 'onReady') {
      if (this.options.events && typeof this.options.events.onReady === 'function') {
        this.options.events.onReady({ target: this });
      }
    } else if (data.event === 'onStateChange') {
      this.currentState = data.info;
      if (this.options.events && typeof this.options.events.onStateChange === 'function') {
        this.options.events.onStateChange({ target: this, data: data.info });
      }
    }
  };

  // --- API Methods ---

  WhoTube.Player.prototype.playVideo = function() {
    this.sendCommand('playVideo');
  };

  WhoTube.Player.prototype.pauseVideo = function() {
    this.sendCommand('pauseVideo');
  };

  WhoTube.Player.prototype.stopVideo = function() {
    this.sendCommand('stopVideo');
  };

  WhoTube.Player.prototype.seekTo = function(seconds) {
    this.sendCommand('seekTo', [seconds]);
  };

  WhoTube.Player.prototype.setVolume = function(volume) {
    this.sendCommand('setVolume', [volume]);
  };

  WhoTube.Player.prototype.mute = function() {
    this.sendCommand('mute');
  };

  WhoTube.Player.prototype.unMute = function() {
    this.sendCommand('unMute');
  };

  WhoTube.Player.prototype.getPlayerState = function() {
    return this.currentState;
  };

  WhoTube.Player.prototype.getIframe = function() {
    return this.iframe;
  };

  WhoTube.Player.prototype.sendCommand = function(func, args) {
    if (!this.iframe || !this.iframe.contentWindow) return;
    this.iframe.contentWindow.postMessage(JSON.stringify({
      event: 'command',
      func: func,
      args: args || [],
      id: this.widgetId
    }), '*');
  };

  // グローバルに公開
  window.WhoTube = WhoTube;

  // API準備完了通知
  if (typeof window.onWhoTubeIframeAPIReady === 'function') {
    window.onWhoTubeIframeAPIReady();
  }
})();

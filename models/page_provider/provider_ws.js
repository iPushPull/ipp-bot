"use strict";
var __extends = (this && this.__extends) || (function () {
    var extendStatics = Object.setPrototypeOf ||
        ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
        function (d, b) { for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p]; };
    return function (d, b) {
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
var config = require("../../config");
var provider_1 = require("./provider");
var io = require("socket.io-client");
var merge = require("merge");
var debug = require("debug")("ipp:page:ws");
var PageProviderWS = (function (_super) {
    __extends(PageProviderWS, _super);
    function PageProviderWS(pageId, _folderId, _accessToken) {
        var _this = _super.call(this, pageId) || this;
        _this.pageId = pageId;
        _this._folderId = _folderId;
        _this._accessToken = _accessToken;
        _this._metaLoaded = true;
        _this.onConnect = function () {
            debug("provider connected");
            var info = {
                ipushpull: {
                    client_id: config.ipushpull.client_id,
                },
            };
            _this._socket.emit("info", info);
            return;
        };
        _this.onDisconnect = function () {
            debug("provider disconnected");
            return;
        };
        _this.onPageContent = function (data) {
            _this._page = merge.recursive(true, _this._page, data);
            setTimeout(function () {
                _this.emit(provider_1.PageProvider.EVENT_CONTENT_LOADED, _this._page);
            }, (!_this._metaLoaded) ? 300 : 0);
        };
        _this.onPageSettings = function (data) {
            _this._page = merge.recursive(true, _this._page, data);
            _this._metaLoaded = true;
            _this.emit("meta_update", data);
        };
        _this.onPageError = function (data) {
            _this.emit(provider_1.PageProvider.EVENT_ERROR, data);
        };
        _this.start();
        return _this;
    }
    Object.defineProperty(PageProviderWS, "SOCKET_EVENT_PAGE_ERROR", {
        get: function () { return "page_error"; },
        enumerable: true,
        configurable: true
    });
    Object.defineProperty(PageProviderWS, "SOCKET_EVENT_PAGE_CONTENT", {
        get: function () { return "page_content"; },
        enumerable: true,
        configurable: true
    });
    Object.defineProperty(PageProviderWS, "SOCKET_EVENT_PAGE_PUSH", {
        get: function () { return "page_push"; },
        enumerable: true,
        configurable: true
    });
    Object.defineProperty(PageProviderWS, "SOCKET_EVENT_PAGE_SETTINGS", {
        get: function () { return "page_settings"; },
        enumerable: true,
        configurable: true
    });
    Object.defineProperty(PageProviderWS, "SOCKET_EVENT_PAGE_DATA", {
        get: function () { return "page_data"; },
        enumerable: true,
        configurable: true
    });
    Object.defineProperty(PageProviderWS, "SOCKET_EVENT_PAGE_USER_JOINED", {
        get: function () { return "page_user_joined"; },
        enumerable: true,
        configurable: true
    });
    Object.defineProperty(PageProviderWS, "SOCKET_EVENT_PAGE_USER_LEFT", {
        get: function () { return "page_user_left"; },
        enumerable: true,
        configurable: true
    });
    Object.defineProperty(PageProviderWS.prototype, "page", {
        get: function () { return this._page; },
        enumerable: true,
        configurable: true
    });
    Object.defineProperty(PageProviderWS.prototype, "accessToken", {
        set: function (accessToken) { this._accessToken = accessToken; },
        enumerable: true,
        configurable: true
    });
    PageProviderWS.prototype.destroy = function () {
        debug("destroying ws provider");
        this.stop();
        _super.prototype.destroy.call(this);
    };
    PageProviderWS.prototype.start = function () {
        this._socket = this.connect();
        this._socket.on("connect", this.onConnect);
        this._socket.on(PageProviderWS.SOCKET_EVENT_PAGE_CONTENT, this.onPageContent);
        this._socket.on(PageProviderWS.SOCKET_EVENT_PAGE_SETTINGS, this.onPageSettings);
        this._socket.on(PageProviderWS.SOCKET_EVENT_PAGE_ERROR, this.onPageError);
        this._socket.on("disconnect", this.onDisconnect);
    };
    PageProviderWS.prototype.stop = function () {
        this._socket.removeAllListeners();
        this._socket.disconnect();
    };
    PageProviderWS.prototype.getTagValue = function (tag) {
        if (!this._page) {
            return;
        }
        var tagValue = undefined;
        for (var i = 0; i < this._page.content.length; i++) {
            for (var j = 0; j < this._page.content[i].length; j++) {
                if (this._page.content[i][j].hasOwnProperty("tag") && this._page.content[i][j].tag.indexOf(tag) >= 0) {
                    tagValue = this._page.content[i][j].value;
                    break;
                }
            }
        }
        return tagValue;
    };
    PageProviderWS.prototype.connect = function () {
        var query = [];
        query = query.filter(function (val) {
            return (val.length > 0);
        });
        return io.connect(config.ipushpull.ws_url + "/page/" + this.pageId, {
            query: query.join("&"),
            transports: ["websocket"],
            forceNew: true,
        });
    };
    return PageProviderWS;
}(provider_1.PageProvider));
exports.PageProviderWS = PageProviderWS;

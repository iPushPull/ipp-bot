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
var ipp_api_1 = require("../../ipp_api");
var Q = require("q");
var debug = require("debug")("ipp:page:rest");
var PageProviderREST = (function (_super) {
    __extends(PageProviderREST, _super);
    function PageProviderREST(pageId, _folderId, _accessToken, _interval, autoStart) {
        if (_interval === void 0) { _interval = 10000; }
        if (autoStart === void 0) { autoStart = true; }
        var _this = _super.call(this, pageId) || this;
        _this.pageId = pageId;
        _this._folderId = _folderId;
        _this._accessToken = _accessToken;
        _this._interval = _interval;
        _this._requestOngoing = false;
        _this._api = new ipp_api_1.ipushpull.Api(config.ipushpull.endpoint);
        if (autoStart) {
            _this.start();
        }
        return _this;
    }
    PageProviderREST.get = function (pageId, folderId, accessToken) {
        var provider = new PageProviderREST(pageId, folderId, accessToken, undefined, false);
        return provider.latest();
    };
    PageProviderREST.getPageByName = function (folderName, pageName, accessToken) {
        var api = new ipp_api_1.ipushpull.Api(config.ipushpull.endpoint);
        return api.getPageByName({ domainId: folderName, pageId: pageName });
    };
    Object.defineProperty(PageProviderREST.prototype, "page", {
        get: function () { return this._page; },
        enumerable: true,
        configurable: true
    });
    Object.defineProperty(PageProviderREST.prototype, "accessToken", {
        set: function (accessToken) { this._accessToken = accessToken; },
        enumerable: true,
        configurable: true
    });
    PageProviderREST.prototype.start = function () {
        var _this = this;
        this.load().finally(function () {
            debug("starting interval for polling");
            _this._timer = setInterval(function () {
                debug("time for next update");
                _this.load();
            }, _this._interval);
        });
    };
    PageProviderREST.prototype.stop = function () {
        if (this._timer) {
            debug("clearing poll interval");
            clearInterval(this._timer);
        }
    };
    PageProviderREST.prototype.latest = function () {
        return this.load(true);
    };
    PageProviderREST.prototype.destroy = function () {
        this.stop();
        _super.prototype.destroy.call(this);
    };
    PageProviderREST.prototype.load = function (ignoreSeqNo) {
        var _this = this;
        if (ignoreSeqNo === void 0) { ignoreSeqNo = false; }
        var q = Q.defer();
        if (this._requestOngoing) {
            debug("page %s will not be loaded as it is still waiting for last request to complete", this.pageId);
            q.reject("Request is ongoing");
            return q.promise;
        }
        this._requestOngoing = true;
        debug("page %s loading (seq_no: %s)", this.pageId, ((!ignoreSeqNo && this._page) ? this._page.seq_no : null));
        this._api.getPage({ domainId: this._folderId, pageId: this.pageId, seq_no: (this._page) ? this._page.seq_no : 0 }).then(function (res) {
            _this._requestOngoing = false;
            if (res.httpCode === 200 || res.httpCode === 204) {
                var page = void 0;
                if (res.httpCode === 200) {
                    var page_1 = res.data;
                    _this._page = page_1;
                    debug("page %s loaded (new version)", page_1.id);
                    _this.emit(provider_1.PageProvider.EVENT_CONTENT_LOADED, page_1);
                }
                else {
                    debug("page %s loaded (no new data)", _this.pageId);
                }
                q.resolve(page);
            }
            else {
                debug("page %s loading error (%s) %s", _this.pageId, res.statusCode, res.statusMessage);
                _this.emit(provider_1.PageProvider.EVENT_ERROR, res);
                q.reject(res);
            }
        }, function (err) {
            _this._requestOngoing = false;
            debug("page %s loading error %s", _this.pageId, err);
            _this.emit(provider_1.PageProvider.EVENT_ERROR, err);
            q.reject(err);
        });
        return q.promise;
    };
    PageProviderREST.prototype.getTagValue = function (tag) {
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
    return PageProviderREST;
}(provider_1.PageProvider));
exports.PageProviderREST = PageProviderREST;

"use strict";
var __extends = (this && this.__extends) || function (d, b) {
    for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
    function __() { this.constructor = d; }
    d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
};
var events = require("events");
var ipp_api_1 = require("./ipp_api");
var config = require("./config");
var IPushPull = (function (_super) {
    __extends(IPushPull, _super);
    function IPushPull(username, password) {
        var _this = _super.call(this) || this;
        _this._username = username;
        _this._password = password;
        _this._api = new ipp_api_1.ipushpull.Api(config.ipushpull.endpoint);
        return _this;
    }
    IPushPull.prototype.auth = function () {
        var _this = this;
        return this._api.userLogin({
            email: this._username,
            password: this._password,
        }).then(function (data) {
            _this._accessToken = data.data.access_token;
            _this._refreshToken = data.data.refresh_token;
            _this._api.accessToken = data.data.access_token;
            console.log("Login", data);
            return true;
        }, function (err) {
            console.log("Could not login!", err);
            return false;
        });
    };
    IPushPull.prototype.getPage = function (pageName, folderName) {
        return this._api.getPageByName({ domainId: folderName, pageId: pageName });
    };
    IPushPull.prototype.getDomain = function (folderName) {
        return this._api.getDomainByName(folderName);
    };
    IPushPull.prototype.getDomainPages = function (folderId) {
        return this._api.getDomainPages(folderId);
    };
    return IPushPull;
}(events.EventEmitter));
exports.IPushPull = IPushPull;

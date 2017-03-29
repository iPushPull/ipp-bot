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
var events = require("events");
var PageProvider = (function (_super) {
    __extends(PageProvider, _super);
    function PageProvider(pageId) {
        var _this = _super.call(this) || this;
        _this.pageId = pageId;
        return _this;
    }
    Object.defineProperty(PageProvider, "EVENT_CONTENT_LOADED", {
        get: function () { return "page_content_loaded"; },
        enumerable: true,
        configurable: true
    });
    ;
    Object.defineProperty(PageProvider, "EVENT_SETTINGS_LOADED", {
        get: function () { return "page_settings_loaded"; },
        enumerable: true,
        configurable: true
    });
    ;
    Object.defineProperty(PageProvider, "EVENT_ERROR", {
        get: function () { return "page_error"; },
        enumerable: true,
        configurable: true
    });
    ;
    PageProvider.tempGetContentOb = function (data) {
        return {
            id: data.id,
            domain_id: data.domain_id,
            seq_no: data.seq_no,
            content_modified_timestamp: data.content_modified_timestamp,
            content: data.content,
            content_modified_by: data.content_modified_by,
            push_interval: data.push_interval,
            pull_interval: data.pull_interval,
            is_public: data.is_public,
            description: data.description,
            encrypted_content: data.encrypted_content,
            encryption_key_used: data.encryption_key_used,
            encryption_type_used: data.encryption_type_used,
            special_page_type: data.special_page_type,
        };
    };
    PageProvider.tempGetSettingsOb = function (data) {
        return JSON.parse(JSON.stringify(data));
    };
    PageProvider.prototype.start = function () { return; };
    PageProvider.prototype.stop = function () { return; };
    PageProvider.prototype.destroy = function () {
        this.removeAllListeners();
    };
    return PageProvider;
}(events.EventEmitter));
exports.PageProvider = PageProvider;

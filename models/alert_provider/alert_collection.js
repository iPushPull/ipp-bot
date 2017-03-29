"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var provider_ws_1 = require("../page_provider/provider_ws");
var TagAlertCollection = (function () {
    function TagAlertCollection() {
        this._watchers = [];
    }
    TagAlertCollection.prototype.watchTag = function (folderId, pageId, tagName, rule, alwaysTrigger, callback) {
        if (alwaysTrigger === void 0) { alwaysTrigger = false; }
        var watcher = this.findWatcher(pageId);
        if (!watcher) {
            watcher = {
                pageId: pageId,
                provider: null,
                subscriptions: [],
            };
            var provider_1 = new provider_ws_1.PageProviderWS(pageId, folderId);
            provider_1.on(provider_ws_1.PageProviderWS.EVENT_CONTENT_LOADED, function (data) {
                for (var i = 0; i < watcher.subscriptions.length; i++) {
                    var tagVal = provider_1.getTagValue(watcher.subscriptions[i].tag);
                    console.log("Evaluating: ", "(" + tagVal + watcher.subscriptions[i].rule + ")");
                    if (eval("(" + tagVal + watcher.subscriptions[i].rule + ")")) {
                        if ((tagVal === watcher.subscriptions[i].lastVal) || (watcher.subscriptions[i].status === "ALARM" && !watcher.subscriptions[i].alwaysTrigger)) {
                            console.log("Preventing alarm trigger");
                            return;
                        }
                        watcher.subscriptions[i].callback(tagVal);
                        watcher.subscriptions[i].status = "ALARM";
                    }
                    else {
                        watcher.subscriptions[i].status = "OK";
                    }
                    watcher.subscriptions[i].lastVal = tagVal;
                }
            });
            watcher.provider = provider_1;
            this._watchers.push(watcher);
        }
        watcher.subscriptions.push({
            tag: tagName,
            rule: rule,
            callback: callback,
            status: "INIT",
            lastVal: 0,
            alwaysTrigger: alwaysTrigger,
        });
    };
    TagAlertCollection.prototype.findWatcher = function (pageId) {
        var watcher;
        for (var i = void 0; i < this._watchers.length; i++) {
            if (this._watchers[i].pageId === pageId) {
                watcher = this._watchers[i];
                break;
            }
        }
        return watcher;
    };
    return TagAlertCollection;
}());
exports.TagAlertCollection = TagAlertCollection;

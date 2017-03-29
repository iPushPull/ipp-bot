"use strict";
var merge = require("merge");
var http = require("httpinvoke");
var config = require("./config");
var query = require("querystring");
var Q = require("q");
var ipushpull;
(function (ipushpull) {
    "use strict";
    var converters = {
        "text json": JSON.parse,
        "json text": JSON.stringify,
    };
    var httpWrap = function (options) {
        var url = options.url;
        if (options.params) {
            url += "/?" + query.stringify(options.params);
        }
        return http(url, options.method, {
            converters: converters,
            inputType: (typeof options.data === "object") ? "json" : "auto",
            input: options.data,
            headers: options.headers,
        });
    };
    var Request = (function () {
        function Request(method, url) {
            this._headers = {};
            this._cache = false;
            this._overrideLock = false;
            this._method = method;
            this._url = url;
            this._headers = {
                "Content-Type": "application/json",
            };
        }
        Request.get = function (url) {
            return new Request("GET", url);
        };
        Request.post = function (url) {
            return new Request("POST", url);
        };
        Request.put = function (url) {
            return new Request("PUT", url);
        };
        Request.del = function (url) {
            return new Request("DELETE", url);
        };
        Object.defineProperty(Request.prototype, "METHOD", {
            get: function () { return this._method; },
            enumerable: true,
            configurable: true
        });
        Object.defineProperty(Request.prototype, "URL", {
            get: function () { return this._url; },
            enumerable: true,
            configurable: true
        });
        Object.defineProperty(Request.prototype, "HEADERS", {
            get: function () { return this._headers; },
            enumerable: true,
            configurable: true
        });
        Object.defineProperty(Request.prototype, "DATA", {
            get: function () { return this._data; },
            enumerable: true,
            configurable: true
        });
        Object.defineProperty(Request.prototype, "PARAMS", {
            get: function () { return this._params; },
            enumerable: true,
            configurable: true
        });
        Object.defineProperty(Request.prototype, "CACHE", {
            get: function () { return this._cache; },
            enumerable: true,
            configurable: true
        });
        Object.defineProperty(Request.prototype, "OVERRIDE_LOCK", {
            get: function () { return this._overrideLock; },
            enumerable: true,
            configurable: true
        });
        Request.prototype.method = function (method) {
            this._method = method;
            return this;
        };
        Request.prototype.url = function (url) {
            this._url = url;
            return this;
        };
        Request.prototype.headers = function (headers, overwrite) {
            if (overwrite === void 0) { overwrite = false; }
            this._headers = (overwrite) ? headers : merge.recursive(true, this._headers, headers);
            return this;
        };
        Request.prototype.data = function (data) {
            this._data = data;
            return this;
        };
        Request.prototype.params = function (params, overwrite) {
            if (overwrite === void 0) { overwrite = false; }
            this._params = (overwrite) ? params : merge.recursive(true, this._params, params);
            return this;
        };
        Request.prototype.cache = function (cache) {
            if (cache && this._method === "GET") {
                this._cache = cache;
            }
            return this;
        };
        Request.prototype.overrideLock = function (override) {
            if (override === void 0) { override = true; }
            this._overrideLock = override;
            return this;
        };
        return Request;
    }());
    var Api = (function () {
        function Api(endpoint) {
            var _this = this;
            this._locked = false;
            this.$http = httpWrap;
            this.$q = Q;
            this.dummyRequest = function (data) {
                console.log("Api is locked down, preventing call " + data.url);
                var q = _this.$q.defer();
                q.reject({
                    data: {},
                    status: 666,
                    statusText: "Api is locked",
                    config: data,
                });
                return q.promise;
            };
            this.handleSuccess = function (response) {
                var q = _this.$q.defer();
                if (response.statusCode < 200 || response.statusCode > 299) {
                    return _this.handleError(response);
                }
                response.body = JSON.parse(response.body);
                q.resolve({
                    success: true,
                    data: response.body,
                    httpCode: parseInt(response.statusCode, 10),
                    httpText: response.statusText || "",
                });
                return q.promise;
            };
            this.handleError = function (response) {
                var q = _this.$q.defer();
                response.body = JSON.parse(response.body);
                q.reject({
                    success: false,
                    data: response.body,
                    httpCode: parseInt(response.statusCode, 10),
                    httpText: response.statusText || "",
                });
                return q.promise;
            };
            this._endPoint = endpoint;
        }
        Api.prototype.block = function () {
            this._locked = true;
        };
        Api.prototype.unblock = function () {
            this._locked = false;
        };
        Api.prototype.getSelfInfo = function () {
            return this
                .send(Request.get(this._endPoint + "/users/self/")
                .cache(false)
                .overrideLock());
        };
        Api.prototype.refreshAccessTokens = function (refreshToken) {
            return this.send(Request.post(this._endPoint + "/oauth/token/")
                .data(query.stringify({
                grant_type: "refresh_token",
                client_id: config.ipushpull.api_key,
                client_secret: config.ipushpull.api_secret,
                refresh_token: refreshToken,
            }))
                .headers({
                "Content-Type": "application/x-www-form-urlencoded",
            })
                .overrideLock());
        };
        Api.prototype.userLogin = function (data) {
            return this.send(Request.post(this._endPoint + "/oauth/token/")
                .data(query.stringify({
                grant_type: "password",
                client_id: config.ipushpull.api_key,
                client_secret: config.ipushpull.api_secret,
                username: data.email,
                password: data.password,
            }))
                .headers({
                "Content-Type": "application/x-www-form-urlencoded",
            }));
        };
        Api.prototype.getDomains = function () {
            return this.send(Request.get(this._endPoint + "/domains/"));
        };
        Api.prototype.getDomain = function (domainId) {
            return this.send(Request.get(this._endPoint + "/domains/" + domainId + "/"));
        };
        Api.prototype.createFolder = function (data) {
            return this.send(Request.post(this._endPoint + "/domains/").data(data.data));
        };
        Api.prototype.updateDomain = function (data) {
            return this.send(Request
                .put(this._endPoint + "/domains/" + data.domainId + "/")
                .data(data.data));
        };
        Api.prototype.getDomainByName = function (domainName) {
            console.log("getDomainByName", this._endPoint + "/domains/name/" + domainName + "/");
            return this.send(Request.get(this._endPoint + "/domains/name/" + domainName + "/"));
        };
        Api.prototype.getDomainPages = function (domainId) {
            return this.send(Request.get(this._endPoint + "/domains/" + domainId + "/page_access/"));
        };
        Api.prototype.getDomainsAndPages = function () {
            return this.send(Request.get(this._endPoint + "/domain_page_access/"));
        };
        Api.prototype.getPage = function (data) {
            return this.send(Request
                .get(this._endPoint + "/domains/id/" + data.domainId + "/page_content/id/" + data.pageId + "/")
                .params({ client_seq_no: data.seq_no }));
        };
        Api.prototype.getPageByName = function (data) {
            console.log(data);
            var url = this._endPoint + "/domains/names/" + data.domainId + "/page_content/name/" + data.pageId + "/";
            console.log(url);
            return this.send(Request
                .get(this._endPoint + "/domains/name/" + data.domainId + "/page_content/name/" + data.pageId + "/")
                .params({ client_seq_no: data.seq_no }));
        };
        Api.prototype.getPageByUuid = function (data) {
            return this.send(Request
                .get(this._endPoint + "/internal/page_content/" + data.uuid + "/")
                .params({ client_seq_no: data.seq_no }));
        };
        Api.prototype.getPageAccess = function (data) {
            return this.send(Request.get(this._endPoint + "/domains/id/" + data.domainId + "/page_access/id/" + data.pageId + "/"));
        };
        Api.prototype.createPage = function (data) {
            return this.send(Request
                .post(this._endPoint + "/domains/" + data.domainId + "/pages/")
                .data(data.data));
        };
        Api.prototype.createAnonymousPage = function (data) {
            return this.send(Request
                .post(this._endPoint + "/anonymous/page/")
                .data(data.data));
        };
        Api.prototype.savePageContent = function (data) {
            return this.send(Request
                .put(this._endPoint + "/domains/id/" + data.domainId + "/page_content/id/" + data.pageId + "/")
                .data(data.data));
        };
        Api.prototype.savePageContentDelta = function (data) {
            return this.send(Request
                .put(this._endPoint + "/domains/id/" + data.domainId + "/page_content_delta/id/" + data.pageId + "/")
                .data(data.data));
        };
        Api.prototype.savePageSettings = function (data) {
            return this.send(Request
                .put(this._endPoint + "/domains/" + data.domainId + "/pages/" + data.pageId + "/")
                .data(data.data));
        };
        Api.prototype.deletePage = function (data) {
            return this.send(Request.del(this._endPoint + "/domains/" + data.domainId + "/pages/" + data.pageId + "/"));
        };
        Api.prototype.saveUserInfo = function (data) {
            return this.send(Request.put(this._endPoint + "/users/self/").data(data));
        };
        Api.prototype.getUserMetaData = function (data) {
            return this.send(Request.get(this._endPoint + "/users/" + data.userId + "/meta/").data(data.data));
        };
        Api.prototype.saveUserMetaData = function (data) {
            return this.send(Request.put(this._endPoint + "/users/" + data.userId + "/meta/").data(data.data));
        };
        Api.prototype.deleteUserMetaData = function (data) {
            return this.send(Request.del(this._endPoint + "/users/" + data.userId + "/meta/").data(data.data));
        };
        Api.prototype.changePassword = function (data) {
            return this.send(Request.put(this._endPoint + "/credentials/self/").data(data));
        };
        Api.prototype.changeEmail = function (data) {
            return this.send(Request.put(this._endPoint + "/credentials/self/").data(data));
        };
        Api.prototype.forgotPassword = function (data) {
            return this.send(Request.post(this._endPoint + "/password_reset/").data(data));
        };
        Api.prototype.resetPassword = function (data) {
            return this.send(Request.post(this._endPoint + "/password_reset/confirm/").data(data));
        };
        Api.prototype.inviteUsers = function (data) {
            return this.send(Request.post(this._endPoint + "/domains/" + data.domainId + "/invitations/").data(data.data));
        };
        Api.prototype.acceptInvitation = function (data) {
            return this.send(Request.post(this._endPoint + "/users/invitation/confirm/").data(data));
        };
        Api.prototype.refuseInvitation = function (data) {
            return this.send(Request.del(this._endPoint + "/users/invitation/confirm/").data(data));
        };
        Api.prototype.domainInvitations = function (data) {
            return this.send(Request
                .get(this._endPoint + "/domains/" + data.domainId + "/invitations/")
                .params({ is_complete: "False" }));
        };
        Api.prototype.userInvitations = function () {
            return this.send(Request
                .get(this._endPoint + "/users/self/invitations/")
                .params({ is_complete: "False" }));
        };
        Api.prototype.domainAccessLog = function (data) {
            return this.send(Request
                .get(this._endPoint + "/domain_access/" + data.domainId + "/events/")
                .params({ page_size: data.limit }));
        };
        Api.prototype.domainUsers = function (data) {
            return this.send(Request.get(this._endPoint + "/domain_access/" + data.domainId + "/users/"));
        };
        Api.prototype.signupUser = function (data) {
            return this.send(Request.post(this._endPoint + "/users/signup/").data(data));
        };
        Api.prototype.activateUser = function (data) {
            return this.send(Request.post(this._endPoint + "/users/signup/confirm/").data(data));
        };
        Api.prototype.setDomainDefault = function (data) {
            return this.send(Request.put(this._endPoint + "/domain_access/" + data.domainId + "/users/self/").data(data.data));
        };
        Api.prototype.resendInvite = function (data) {
            return this.send(Request.put(this._endPoint + "/domains/" + data.domainId + "/invitations/" + data.inviteId + "/resend/"));
        };
        Api.prototype.updateDomainAccess = function (data) {
            return this.send(Request.put(this._endPoint + "/domain_access/" + data.domainId + "/users/").data(data.data));
        };
        Api.prototype.removeUsersFromDomain = function (data) {
            return this.send(Request.del(this._endPoint + "/domain_access/" + data.domainId + "/users/").data(data.data));
        };
        Api.prototype.getInvitation = function (data) {
            return this.send(Request.get(this._endPoint + "/users/invitations/" + data.token + "/"));
        };
        Api.prototype.cancelInvitations = function (data) {
            return this.send(Request.del(this._endPoint + "/domains/" + data.domainId + "/invitations/").data(data.data));
        };
        Api.prototype.getDomainAccessGroups = function (data) {
            return this.send(Request.get(this._endPoint + "/domains/" + data.domainId + "/access_groups/"));
        };
        Api.prototype.getDomainAccessGroup = function (data) {
            return this.send(Request.get(this._endPoint + "/domains/" + data.domainId + "/access_groups/" + data.groupId + "/"));
        };
        Api.prototype.addDomainAccessGroup = function (data) {
            return this.send(Request.post(this._endPoint + "/domains/" + data.domainId + "/access_groups/").data(data.data));
        };
        Api.prototype.putDomainAgroupMembers = function (data) {
            return this.send(Request.post(this._endPoint + "/domains/" + data.domainId + "/access_groups/" + data.agroupId + "/members/").data(data.data));
        };
        Api.prototype.putDomainAgroupPages = function (data) {
            return this.send(Request.post(this._endPoint + "/domains/" + data.domainId + "/access_groups/" + data.agroupId + "/pages/").data(data.data));
        };
        Api.prototype.updateDomainAgroup = function (data) {
            return this.send(Request.put(this._endPoint + "/domains/" + data.domainId + "/access_groups/" + data.agroupId + "/").data(data.data));
        };
        Api.prototype.deleteDomainAGroup = function (data) {
            return this.send(Request.del(this._endPoint + "/domains/" + data.domainId + "/access_groups/" + data.agroupId + "/"));
        };
        Api.prototype.getDomainPageAccess = function (data) {
            return this.send(Request.get(this._endPoint + "/domain_page_access/" + data.domainId + "/"));
        };
        Api.prototype.getDomainCustomers = function (data) {
            return this.send(Request.get(this._endPoint + "/domains/" + data.domainId + "/customers/"));
        };
        Api.prototype.saveDomainPageAccess = function (data) {
            return this.send(Request.put(this._endPoint + "/domain_page_access/" + data.domainId + "/basic/").data(data.data));
        };
        Api.prototype.getTemplates = function (data) {
            return this.send(Request.get(this._endPoint + "/templates/"));
        };
        Api.prototype.saveCustomer = function (data) {
            return this.send(Request.post(this._endPoint + "/domains/" + data.domainId + "/customers/").data(data.data));
        };
        Api.prototype.updateCustomer = function (data) {
            return this.send(Request.put(this._endPoint + "/domains/" + data.domainId + "/customers/" + data.data.id + "/").data(data.data));
        };
        Api.prototype.removeCustomer = function (data) {
            return this.send(Request.del(this._endPoint + "/domains/" + data.domainId + "/customers/" + data.customerId + "/"));
        };
        Api.prototype.getDocEmailRules = function (data) {
            return this.send(Request.get(this._endPoint + "/domains/" + data.domainId + "/docsnames/"));
        };
        Api.prototype.createDocEmailRule = function (data) {
            return this.send(Request.post(this._endPoint + "/domains/" + data.domainId + "/docsnames/").data(data.data));
        };
        Api.prototype.updateDocEmailRule = function (data) {
            return this.send(Request.put(this._endPoint + "/domains/" + data.domainId + "/docsnames/" + data.docRuleId + "/").data(data.data));
        };
        Api.prototype.deleteDocEmailRule = function (data) {
            return this.send(Request.del(this._endPoint + "/domains/" + data.domainId + "/docsnames/" + data.docRuleId + "/"));
        };
        Api.prototype.send = function (request) {
            console.log("send", this.accessToken, request);
            request.headers({
                "Authorization": "Bearer " + ((this.accessToken) ? this.accessToken : "null"),
            });
            if (request.METHOD === "GET") {
                request.headers({ "Content-Type": "" });
            }
            var provider = (this._locked && !request.OVERRIDE_LOCK) ? this.dummyRequest : this.$http;
            request.cache(false);
            var r = provider({
                url: request.URL,
                cache: request.CACHE,
                method: request.METHOD,
                params: request.PARAMS,
                data: request.DATA,
                headers: request.HEADERS,
            });
            return r.then(this.handleSuccess, this.handleError);
        };
        return Api;
    }());
    ipushpull.Api = Api;
})(ipushpull = exports.ipushpull || (exports.ipushpull = {}));

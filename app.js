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
var config = require("./config");
var ipp_api_1 = require("./ipp_api");
var alert_collection_1 = require("./models/alert_provider/alert_collection");
var events = require("events");
var Table = require("cli-table2");
var builder = require('./core/');
var restify = require('restify');
var accessToken;
var refreshToken;
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
            accessToken = data.data.access_token;
            refreshToken = data.data.refresh_token;
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
    IPushPull.prototype.getTagValue = function (content, tag) {
        var tagValue = undefined;
        for (var i = 0; i < content.length; i++) {
            for (var j = 0; j < content[i].length; j++) {
                if (content[i][j].hasOwnProperty("tag") && content[i][j].tag.indexOf(tag) >= 0) {
                    tagValue = content[i][j].formatted_value || content[i][j].value;
                    break;
                }
            }
        }
        return tagValue;
    };
    return IPushPull;
}(events.EventEmitter));
var ipp = new IPushPull(config.ipushpull.username, config.ipushpull.password);
var alertCollection = new alert_collection_1.TagAlertCollection();
ipp.auth().then(function (auth) {
    console.log(auth);
}, function (err) {
    console.log(err);
});
var server = restify.createServer();
server.listen(process.env.port || process.env.PORT || 3978, function () {
    console.log('%s listening to %s', server.name, server.url);
});
var connector = new builder.ChatConnector({
    appId: config.bot.appId,
    appPassword: config.bot.appPassword
});
var bot = new builder.UniversalBot(connector);
server.post('/api/messages', connector.listen());
bot.on('conversationUpdate', function (message) {
    if (message.address.conversation.isGroup) {
        if (message.membersAdded) {
            message.membersAdded.forEach(function (identity) {
                if (identity.id === message.address.bot.id) {
                    var reply = new builder.Message()
                        .address(message.address)
                        .text("Hello everyone!");
                    bot.send(reply);
                }
            });
        }
        if (message.membersRemoved) {
            message.membersRemoved.forEach(function (identity) {
                if (identity.id === message.address.bot.id) {
                    var reply = new builder.Message()
                        .address(message.address)
                        .text("Goodbye");
                    bot.send(reply);
                }
            });
        }
    }
});
bot.on('contactRelationUpdate', function (message) {
    if (message.action === 'add') {
        var name = message.user ? message.user.name : null;
        var reply = new builder.Message()
            .address(message.address)
            .text("Hello %s... Thanks for adding me. Say 'hello' to see some great demos.", name || 'there');
        bot.send(reply);
    }
    else {
    }
});
bot.on('deleteUserData', function (message) {
});
bot.use(builder.Middleware.dialogVersion({ version: 1.0, resetCommand: /^reset/i }));
bot.endConversationAction('goodbye', 'Goodbye :)', { matches: /^goodbye/i });
bot.beginDialogAction('help', '/help', { matches: /^help/i });
bot.on('trigger', function (message) {
    var queuedMessage = message.value;
    var reply = new builder.Message()
        .address(queuedMessage.address)
        .text('This is coming from the trigger: ' + queuedMessage.text);
    bot.send(reply);
});
bot.dialog('/', [
    function (session) {
        var card = new builder.HeroCard(session)
            .title("ipushpull bot")
            .images([
            builder.CardImage.create(session, "https://ipushpull.s3.amazonaws.com/static/prd/icon-32.png")
        ]);
        var msg = new builder.Message(session).attachments([card]);
        session.send(msg);
        session.beginDialog('/pull');
    }
]);
bot.dialog('/pull', [
    function (session) {
        builder.Prompts.text(session, "What iPushPull folder would you like to work with?");
    },
    function (session, results) {
        session.userData.folderName = results.response;
        session.sendTyping();
        ipp.getDomain(session.userData.folderName).then(function (res) {
            session.userData.folderId = res.data.id;
            ipp.getDomainPages(session.userData.folderId).then(function (res) {
                session.userData.domainPages = [];
                for (var i = 0; i < res.data.pages.length; i++) {
                    if (res.data.pages[i].special_page_type != 0 || !res.data.pages[i].is_public) {
                        continue;
                    }
                    session.userData.domainPages.push(res.data.pages[i].name);
                }
                session.send("Got it, here is the list of pages in " + session.userData.folderName);
                session.sendTyping();
                setTimeout(function () {
                    builder.Prompts.choice(session, "", session.userData.domainPages.join("|"));
                    session.send("What page would you like to work with? Type its number or name from the list above");
                }, 2000);
            }, function (err) {
                console.log(err);
                session.send("Failed to load pages");
                session.endDialog();
                session.beginDialog("/pull");
            });
        }, function (err) {
            console.log(err);
            session.send("Failed to load folder");
            session.endDialog();
            session.beginDialog("/pull", { hideMessage: true });
        });
    },
    function (session, results) {
        session.userData.pageName = results.response.entity;
        if (session.userData.domainPages.indexOf(session.userData.pageName) < 0) {
            session.send("Page does not exist");
            session.endDialog();
            return;
        }
        var msg = new builder.Message(session)
            .textFormat(builder.TextFormat.xml)
            .attachments([
            new builder.HeroCard(session)
                .title("What would you like to do?")
                .buttons([
                builder.CardAction.postBack(session, "pull_page", "Get the whole page"),
                builder.CardAction.postBack(session, "pull_tag", "Get value of a tag")
            ])
        ]);
        builder.Prompts.choice(session, msg, "pull_page|pull_tag");
    },
    function (session, results) {
        var func = results.response.entity;
        session.sendTyping();
        ipp.getPage(session.userData.pageName, session.userData.folderName).then(function (res) {
            session.userData.page = res.data;
            if (func === "pull_page") {
                var imageUrl = config.ipushpull.docs_url + "/export/image?pageId=" + res.data.id + "&config=slack";
                var tableOptions = {
                    style: { border: [] },
                };
                var table = new Table(tableOptions);
                for (var i = 0; i < res.data.content.length; i++) {
                    table.push(res.data.content[i].map(function (cell) {
                        return cell.formatted_value || cell.value;
                    }));
                }
                var msg = void 0;
                switch (session.message.address.channelId) {
                    case "slack":
                    case "emulator":
                        msg = new builder.Message(session)
                            .text("`" + table.toString() + "`");
                        session.send(msg);
                        console.log(table.toString());
                        break;
                    default:
                        msg = new builder.Message(session)
                            .attachments([{
                                contentType: "image/jpeg",
                                contentUrl: imageUrl
                            }]);
                        session.send(msg);
                        break;
                }
                session.endDialog();
            }
            if (func === "pull_tag") {
                builder.Prompts.text(session, "What is the name of tag you would like to get?");
            }
        }, function (err) {
            session.send("Failed to load page");
            session.endDialog();
        });
    }, function (session, results) {
        var tagName = results.response;
        var tagVal = ipp.getTagValue(session.userData.page.content, tagName);
        session.userData.tagName = tagName;
        if (typeof tagVal !== "undefined") {
            var msg = new builder.Message(session)
                .textFormat(builder.TextFormat.xml)
                .attachments([
                new builder.HeroCard(session)
                    .title(tagName)
                    .text(tagVal)
                    .buttons([
                    builder.CardAction.dialogAction(session, "alert_create", null, "Create alert"),
                ])
            ]);
            session.send(msg);
        }
        else {
            session.send("This tag does not exist");
        }
    }
]);
bot.beginDialogAction("alert_create", "/alert");
bot.dialog("/alert", [
    function (session) {
        builder.Prompts.text(session, "When would you like me to notify you? Use '<50' or '>50' for example");
    }, function (session, results) {
        var rule = results.response;
        session.send("OK, I will let you know when " + session.userData.tagName + " is " + rule);
        alertCollection.watchTag(session.userData.page.domain_id, session.userData.page.id, session.userData.tagName, rule, false, function (val) {
            var msg = new builder.Message()
                .address(session.message.address)
                .text("YO! " + session.userData.tagName + " is " + rule + " ! Current value is " + val);
            bot.send(msg);
        });
        session.endDialog();
    }
]);

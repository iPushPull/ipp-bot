"use strict";
var __extends = (this && this.__extends) || function (d, b) {
    for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
    function __() { this.constructor = d; }
    d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
};
var config = require("./config");
var ipp_api_1 = require("./ipp_api");
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
    return IPushPull;
}(events.EventEmitter));
var ipp = new IPushPull(config.ipushpull.username, config.ipushpull.password);
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
    },
    function (session, results) {
        session.beginDialog('/pull');
    },
    function (session, results) {
        session.beginDialog('/pull');
    }
]);
var folderName;
var folderId;
var pageName;
var pageId;
var domainPages = [];
bot.dialog('/pull', [
    function (session) {
        console.log("session data", session);
        builder.Prompts.text(session, "What is your folder name?");
    },
    function (session, results) {
        folderName = results.response;
        session.sendTyping();
        ipp.getDomain(folderName).then(function (res) {
            folderId = res.data.id;
            ipp.getDomainPages(folderId).then(function (res) {
                domainPages = [];
                for (var i = 0; i < res.data.pages.length; i++) {
                    if (res.data.pages[i].special_page_type != 0 || !res.data.pages[i].is_public) {
                        continue;
                    }
                    domainPages.push(res.data.pages[i].name);
                }
                builder.Prompts.choice(session, "Please select a page?", domainPages.join("|"));
            }, function (err) {
                console.log(err);
                session.send("Failed to load pages");
                session.endDialog();
            });
        }, function (err) {
            console.log(err);
            session.send("Failed to load folder");
            session.endDialog();
        });
    },
    function (session, results) {
        pageName = results.response.entity;
        if (domainPages.indexOf(pageName) == -1) {
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
                builder.CardAction.imBack(session, "pull", "Pull page data"),
                builder.CardAction.imBack(session, "alert", "Create Alert")
            ])
        ]);
        builder.Prompts.choice(session, msg, "pull|alert");
    },
    function (session, results) {
        var func = results.response.entity;
        session.sendTyping();
        ipp.getPage(pageName, folderName).then(function (res) {
            if (func === "pull") {
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
            if (func === "alert") {
                builder.Prompts.text(session, "Set alert rule. Eg: tag_name >54.6, tag_name <30.2");
            }
        }, function (err) {
            session.send("Failed to load page");
            session.endDialog();
        });
    },
    function (session, results) {
        session.send("You entered '%s'. Your alert watcher has been started", results.response);
        session.endDialog();
    }
]);

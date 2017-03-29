"use strict";
var config = require("./config");
var ipp_service_1 = require("./ipp_service");
var Table = require("cli-table2");
var util = require('util');
var builder = require('./core/');
var restify = require('restify');
var ipp = new ipp_service_1.IPushPull(config.ipushpull.username, config.ipushpull.password);
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
            .title("ipushpull page bot")
            .images([
            builder.CardImage.create(session, "https://ipushpull.s3.amazonaws.com/static/prd/twitter-card.png")
        ]);
        var msg = new builder.Message(session).attachments([card]);
        session.send(msg);
        session.beginDialog('/pull');
    },
    function (session, results) {
        session.beginDialog('/pull');
    },
    function (session, results) {
        session.beginDialog('/');
    }
]);
bot.dialog('/help', [
    function (session) {
        session.endDialog("Global commands that are available anytime:\n\n* menu - Exits a demo and returns to the menu.\n* goodbye - End this conversation.\n* help - Displays these commands.");
    }
]);
var folderName;
var folderId;
var pageName;
var pageId;
var domainPages = [];
var pageTags = {};
bot.dialog('/pull', [
    function (session) {
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
        ipp.getPage(pageName, folderName).then(function (res) {
            if (session.message.address.channelId === "facebook") {
                var msgFb = new builder.Message(session)
                    .sourceEvent({
                    facebook: {
                        attachment: {
                            type: "template",
                            payload: {
                                template_type: "button",
                                text: "Open live view",
                                buttons: [
                                    {
                                        type: "web_url",
                                        url: config.ipushpull.web_url + "/pages/embed/domains/" + folderName + "/pages/" + pageName,
                                        title: "" + res.data.name,
                                    }
                                ]
                            }
                        }
                    }
                });
                session.send(msgFb);
            }
            var buttons = [];
            if (["emulator", "slack"].indexOf(session.message.address.channelId) != -1) {
                buttons.push(builder.CardAction.imBack(session, "pull", "Pull page data"));
            }
            else {
                buttons.push(builder.CardAction.imBack(session, "pull_image", "Image snapshot"));
            }
            buttons.push(builder.CardAction.imBack(session, "pull_tag", "Pull page tag"));
            buttons.push(builder.CardAction.imBack(session, "alert", "Create alert"));
            var choices = ["pull", "pull_image", "pull_tag", "alert"];
            var attachments = [
                new builder.HeroCard(session)
                    .title(res.data.name)
                    .subtitle("What would you like to do?")
                    .images([
                    builder.CardImage.create(session, getImageUrl(res.data)),
                ])
                    .buttons(buttons)
            ];
            var msg = new builder.Message(session)
                .textFormat(builder.TextFormat.xml)
                .attachments(attachments);
            builder.Prompts.choice(session, msg, choices.join("|"));
        }, function (err) {
            session.send("Failed to load page", err);
            session.endDialog();
        });
    },
    function (session, results) {
        var func = results.response.entity;
        session.sendTyping();
        ipp.getPage(pageName, folderName).then(function (res) {
            findAndSetTags(res.data);
            var msg;
            if (func === "pull") {
                var tableOptions = {
                    style: { border: [] },
                };
                var table = new Table(tableOptions);
                for (var i = 0; i < res.data.content.length; i++) {
                    table.push(res.data.content[i].map(function (cell) {
                        return cell.formatted_value || cell.value;
                    }));
                }
                console.log(table.toString());
                msg = new builder.Message(session)
                    .text("`" + table.toString() + "`");
                session.send(msg);
                session.endDialog();
            }
            if (func === "pull_image") {
                msg = new builder.Message(session)
                    .attachments([{
                        contentType: "image/jpeg",
                        contentUrl: getImageUrl(res.data),
                    }]);
                session.send(msg);
                session.endDialog();
            }
            if (func === "pull_tag") {
                session.userData.func = "pull_tag";
                builder.Prompts.choice(session, "Please enter the tag name", Object.keys(pageTags).join("|"));
            }
            if (func === "alert") {
                session.userData.func = "alert";
                builder.Prompts.text(session, "Set alert rule. Eg: tag_name >54.6, tag_name <30.2");
            }
        }, function (err) {
            session.send("Failed to load page", err);
            session.endDialog();
        });
    },
    function (session, results) {
        if (session.userData.func === "pull_tag") {
            var tag = results.response.entity;
            if (pageTags.hasOwnProperty(tag)) {
                console.log(pageTags[tag]);
                session.send(pageTags[tag].value);
            }
            else {
                session.send("This tag does not exists");
            }
        }
        else {
            session.send("You entered '%s'. Your alert watcher has been started", results.response);
        }
        session.endDialog();
    }
]);
function findAndSetTags(page) {
    pageTags = {};
    for (var i = 0; i < page.content.length; i++) {
        for (var k = 0; k < page.content[i].length; k++) {
            if (!page.content[i][k].tag) {
                continue;
            }
            var tags = page.content[i][k].tag;
            for (var t = 0; t < tags.length; t++) {
                pageTags[tags[t]] = {
                    tag: tags[t],
                    tags: page.content[i][k].tag,
                    value: page.content[i][k].formatted_value || page.content[i][k].value,
                    row: i,
                    col: k
                };
            }
        }
    }
    console.log("pageTags", pageTags);
}
function getImageUrl(page) {
    return config.ipushpull.docs_url + "/export/image?pageId=" + page.id + "&config=slack";
}

import config = require("./config");
import Q = require("q");
import { IPushPull } from "./ipp_service";
import Table = require("cli-table2");

/*-----------------------------------------------------------------------------
This Bot demonstrates how to create a simple First Run experience for a bot.
The triggerAction() for the first run dialog shows how to add a custom 
onFindAction handler that lets you programatically trigger the dialog based off 
a version check. It also uses a custom onInterrupted handler to prevent the 
first run dialog from being interrupted should the user trigger another dialog 
like 'help'. 

# RUN THE BOT:

    Run the bot from the command line using "node app.js" and then type 
    "hello" to wake the bot up.

-----------------------------------------------------------------------------*/

var builder = require('./core/');
var restify = require('restify');

// create ipp service
let ipp = new IPushPull(config.ipushpull.username, config.ipushpull.password);

// err, login
ipp.auth().then((auth) => {
    console.log(auth);
}, (err) => {
    console.log(err);
});

//=========================================================
// Bot Setup
//=========================================================

// Setup Restify Server
var server = restify.createServer();
server.listen(process.env.port || process.env.PORT || 3978, function () {
    console.log('%s listening to %s', server.name, server.url);
});

// Create chat bot
var connector = new builder.ChatConnector({
    appId: config.bot.appId, // process.env.MICROSOFT_APP_ID,
    appPassword: config.bot.appPassword // process.env.MICROSOFT_APP_PASSWORD
});

var bot = new builder.UniversalBot(connector);
server.post('/api/messages', connector.listen());

//=========================================================
// Activity Events
//=========================================================

bot.on('conversationUpdate', function (message) {
    // Check for group conversations
    if (message.address.conversation.isGroup) {
        // Send a hello message when bot is added
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

        // Send a goodbye message when bot is removed
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
    } else {
        // delete their data
    }
});

bot.on('deleteUserData', function (message) {
    // User asked to delete their data
});



//=========================================================
// Bots Middleware
//=========================================================

// Anytime the major version is incremented any existing conversations will be restarted.
bot.use(builder.Middleware.dialogVersion({ version: 1.0, resetCommand: /^reset/i }));

//=========================================================
// Bots Global Actions
//=========================================================

bot.endConversationAction('goodbye', 'Goodbye :)', { matches: /^goodbye/i });
bot.beginDialogAction('help', '/help', { matches: /^help/i });

// receive external trigger
bot.on('trigger', function (message) {
    // handle message from trigger function
    var queuedMessage = message.value;
    var reply = new builder.Message()
        .address(queuedMessage.address)
        .text('This is coming from the trigger: ' + queuedMessage.text);
    bot.send(reply);
});

//=========================================================
// Bots Dialogs
//=========================================================

bot.dialog('/', [
    function (session) {

        // Send a greeting and show help.
        var card = new builder.HeroCard(session)
            .title("ipushpull page bot")
            // .text("Your bots - wherever your users are talking.")
            .images([
                builder.CardImage.create(session, "https://ipushpull.s3.amazonaws.com/static/prd/twitter-card.png")
            ]);
        var msg = new builder.Message(session).attachments([card]);
        session.send(msg);
        // session.send("Hi... I'm the Microsoft Bot Framework demo bot for Skype. I can show you everything you can use our Bot Builder SDK to do on Skype.");
        session.beginDialog('/pull');
    },
    function (session, results) {
        // Display menu
        session.beginDialog('/pull');
    },
    function (session, results) {
        // Always say goodbye
        // session.beginDialog('/pull');
        session.beginDialog('/');
    }
]);

bot.dialog('/help', [
    function (session) {
        session.endDialog("Global commands that are available anytime:\n\n* menu - Exits a demo and returns to the menu.\n* goodbye - End this conversation.\n* help - Displays these commands.");
    }
]);

let folderName: string;
let folderId: number;
let pageName: string;
let pageId: string;
let domainPages: any = [];
let pageTags: any = {};

bot.dialog('/pull', [
    // ask for folder
    function (session) {
        // session.send("Pull a public page");
        builder.Prompts.text(session, "What is your folder name?");
    },
    // show folder pages
    function (session, results) {

        folderName = results.response;

        session.sendTyping();

        // get domain details
        ipp.getDomain(folderName).then((res) => {

            folderId = res.data.id;

            // now get domain pages
            ipp.getDomainPages(folderId).then((res) => {

                // create prompt for pages
                domainPages = [];
                for (let i: number = 0; i < res.data.pages.length; i++) {
                    if (res.data.pages[i].special_page_type != 0 || !res.data.pages[i].is_public) {
                        continue;
                    }
                    domainPages.push(res.data.pages[i].name);
                }
                builder.Prompts.choice(session, "Please select a page?", domainPages.join("|"));

            }, (err) => {
                console.log(err);
                session.send("Failed to load pages");
                session.endDialog();
            })
        }, (err) => {
            console.log(err);
            session.send("Failed to load folder");
            session.endDialog();
        })
        // session.send("You entered '%s'", results.response);

    },
    // page actions
    function (session, results) {

        pageName = results.response.entity;

        if (domainPages.indexOf(pageName) == -1) {
            session.send("Page does not exist");
            session.endDialog();
            return;
        }

        ipp.getPage(pageName, folderName).then((res) => {

            let buttons: any = [
                builder.CardAction.imBack(session, "pull", "Pull data"),
                builder.CardAction.imBack(session, "pull_image", "Pull image"),
                builder.CardAction.imBack(session, "pull_tag", "Pull page tag"),
                builder.CardAction.imBack(session, "alert", "Create alert"),
            ];

            let choices: any = ["pull", "pull_image", "pull_tag", "alert"];

            if (session.message.address.channelId === "facebook") {
                buttons.push({
                    "type": "web_url",
                    "url": "https://test.ipushpull.com/pages/embed/domains/IEX/pages/IEX_Summary",
                    "title": "iPushPull Page",
                    "webview_height_ratio": "compact" // full, compact
                });
                choices.push("url")
            }

            let msg: any = new builder.Message(session)
                .textFormat(builder.TextFormat.xml)
                // .attachmentLayout(builder.AttachmentLayout.carousel)
                .attachments([
                    new builder.HeroCard(session)
                        .title(res.data.name)
                        .subtitle("What would you like to do?")
                        .images([
                            builder.CardImage.create(session, getImageUrl(res.data)),
                            builder.CardImage.create(session, "https://ipushpull.s3.amazonaws.com/static/prd/icon-32.png")
                        ])
                        .buttons(buttons)
                ]);

            builder.Prompts.choice(session, msg, choices.join("|"));

        }, (err) => {
            session.send("Failed to load page", err);
            session.endDialog();
        });


    },
    // act on page actions
    function (session, results) {

        let func: string = results.response.entity;

        session.sendTyping();

        ipp.getPage(pageName, folderName).then((res) => {

            // get them tags
            findAndSetTags(res.data);

            let msg: any;

            // show table as string
            if (func === "pull") {

                let tableOptions: any = {
                    style: { border: [] },
                };
                let table: any = new Table(tableOptions);

                for (let i: number = 0; i < res.data.content.length; i++) {
                    table.push(res.data.content[i].map((cell) => {
                        return cell.formatted_value || cell.value;
                    }));
                }

                console.log(table.toString());

                msg = new builder.Message(session)
                    .text("`" + table.toString() + "`"); // .replace(/(?:\r\n|\r|\n)/g, '  ')
                session.send(msg);
                session.endDialog();
            }

            // show table as image
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
                // builder.Prompts.text(session, "Please enter the tag name");
            }

            if (func === "alert") {
                session.userData.func = "alert";
                builder.Prompts.text(session, "Set alert rule. Eg: tag_name >54.6, tag_name <30.2");
            }


        }, (err) => {
            session.send("Failed to load page", err);
            session.endDialog();
        });
        // session.send("You entered '%s'", results.response);
    },
    // page action
    function (session, results) {
        if (session.userData.func === "pull_tag") {
            let tag: string = results.response.entity;
            if (pageTags.hasOwnProperty(tag)) {
                console.log(pageTags[tag]);
                session.send(pageTags[tag].value);
            } else {
                session.send("This tag does not exists");
            }
            session.endDialog();

        } else {
            session.send("You entered '%s'. Your alert watcher has been started", results.response);
        }
        session.endDialog();
    }
]);

function findAndSetTags(page: any) {
    pageTags = {};
    for (let i: number = 0; i < page.content.length; i++) {
        for (let k: number = 0; k < page.content[i].length; k++) {
            if (!page.content[i][k].tag) {
                continue;
            }
            let tags: any = page.content[i][k].tag;
            for (let t: number = 0; t < tags.length; t++) {
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

function getImageUrl(page: any) {
    return `${config.ipushpull.docs_url}/export/image?pageId=${page.id}&config=slack`;
}


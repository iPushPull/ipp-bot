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
            .title("ipushpull bot")
            // .text("Your bots - wherever your users are talking.")
            .images([
                builder.CardImage.create(session, "https://ipushpull.s3.amazonaws.com/static/prd/icon-32.png")
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
        session.beginDialog('/pull');
    }
]);

let folderName: string;
let folderId: number;
let pageName: string;
let pageId: string;
let domainPages: any = [];
let pageTags: any = {};

bot.dialog('/pull', [
    function (session) {
        // session.send("Pull a public page");
        builder.Prompts.text(session, "What is your folder name?");
    },
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
    function (session, results) {

        pageName = results.response.entity;

        if (domainPages.indexOf(pageName) == -1) {
            session.send("Page does not exist");
            session.endDialog();
            return;
        }

        let msg: any = new builder.Message(session)
            .textFormat(builder.TextFormat.xml)
            // .attachmentLayout(builder.AttachmentLayout.carousel)
            .attachments([
                new builder.HeroCard(session)
                    .title("What would you like to do?")
                    .buttons([
                        builder.CardAction.imBack(session, "pull", "Pull page data"),
                        builder.CardAction.imBack(session, "pull_tag", "Pull page tag"),
                        builder.CardAction.imBack(session, "alert", "Create alarm")
                    ])
            ]);

        // session.send(msg);

        builder.Prompts.choice(session, msg, "pull|pull_tag|alert");

    },
    function (session, results) {

        let func: string = results.response.entity;

        session.sendTyping();

        ipp.getPage(pageName, folderName).then((res) => {

            // get them tags
            findAndSetTags(res.data);

            if (func === "pull") {

                let imageUrl: string = `${config.ipushpull.docs_url}/export/image?pageId=${res.data.id}&config=slack`;

                let tableOptions: any = {
                    style: { border: [] },
                };
                let table: any = new Table(tableOptions);

                for (let i: number = 0; i < res.data.content.length; i++) {
                    table.push(res.data.content[i].map((cell) => {
                        return cell.formatted_value || cell.value;
                    }));
                }

                let msg: any;

                switch (session.message.address.channelId) {
                    case "slack":
                    case "emulator":
                        // show table as string
                        msg = new builder.Message(session)
                            .text("`" + table.toString() + "`");
                        session.send(msg);
                        console.log(table.toString());
                        break;
                    default:
                        // show table as image
                        msg = new builder.Message(session)
                            .attachments([{
                                contentType: "image/jpeg",
                                contentUrl: imageUrl
                            }]);
                        session.send(msg);
                        break;
                }

                session.endDialog();
                // session.replaceDialog('/pull');

            }

            if (func === "pull_tag") {
                session.userData.func = "pull_tag";
                builder.Prompts.text(session, "Please enter the tag name");
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
    function (session, results) {
        if (session.userData.func === "pull_tag") {
            let tag: string = results.response;
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


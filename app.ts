import config = require("./config");
import {TagAlertCollection} from "./models/alert_provider/alert_collection"
import Q = require("q");
import { IPushPull } from "./ipp_service";
import Table = require("cli-table2");
const util = require('util');

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

var builder = require('botbuilder');
var restify = require('restify');

// create ipp service
let ipp = new IPushPull(config.ipushpull.username, config.ipushpull.password);
let alertCollection = new TagAlertCollection();

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
    }
]);

bot.dialog('/pull', [
    (session) => {
        builder.Prompts.text(session, "What iPushPull folder would you like to work with?");
    },
    // show folder pages
    function (session, results) {
        session.userData.folderName = results.response;

        session.sendTyping();

        // get domain details
        ipp.getDomain(session.userData.folderName).then((res) => {
            session.userData.folderId = res.data.id;

            // now get domain pages
            ipp.getDomainPages(session.userData.folderId).then((res) => {

                // create prompt for pages
                session.userData.domainPages = [];
                for (let i: number = 0; i < res.data.pages.length; i++) {
                    // Filter out non-data and non-public pages
                    if (res.data.pages[i].special_page_type != 0 || !res.data.pages[i].is_public) {
                        continue;
                    }
                    session.userData.domainPages.push(res.data.pages[i].name);
                }
                session.send("Got it, here is the list of pages in " + session.userData.folderName);
                session.sendTyping();
                setTimeout(() => {
                    builder.Prompts.choice(session, "", session.userData.domainPages.join("|"));
                    session.send("What page would you like to work with? Type its number or name from the list above");
                }, 2000);                
            }, (err) => {
                console.log(err);
                session.send("Failed to load pages");
                session.endDialog();
                session.beginDialog("/pull");
            })
        }, (err) => {
            console.log(err);
            session.send("Failed to load folder");
            session.endDialog();
            session.beginDialog("/pull", {hideMessage: true});
        })
        // session.send("You entered '%s'", results.response);

    },
    // page actions
    function (session, results) {

        session.userData.pageName = results.response.entity;

        if (session.userData.domainPages.indexOf(session.userData.pageName) < 0) {
            session.send("Page does not exist");
            session.endDialog();
            return;
        }

        ipp.getPage(pageName, folderName).then((res) => {

            // show in overlay. facebook only
            if (session.message.address.channelId === "facebook") {

                let msgFb: any = new builder.Message(session)
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
                                            url: `${config.ipushpull.web_url}/pages/embed/domains/${folderName}/pages/${pageName}`,
                                            title: `${res.data.name}`,
                                            // webview_height_ratio: "compact"
                                        }
                                    ]
                                }
                            }
                        }
                    });

                session.send(msgFb);
            }

            // setup buttons
            let buttons: any = [];
            if (["emulator", "slack"].indexOf(session.message.address.channelId) != -1) {
                buttons.push(builder.CardAction.imBack(session, "pull", "Pull page data"));
            } else {
                buttons.push(builder.CardAction.imBack(session, "pull_image", "Image snapshot"));
            }
            buttons.push(builder.CardAction.imBack(session, "pull_tag", "Pull page tag"));
            buttons.push(builder.CardAction.imBack(session, "alert", "Create alert"));

            // prompt choices
            let choices: any = ["pull", "pull_image", "pull_tag", "alert"];

            // attachments
            let attachments: any = [
                new builder.HeroCard(session)
                    .title(res.data.name)
                    .subtitle("What would you like to do?")
                    .images([
                        builder.CardImage.create(session, getImageUrl(res.data)),                       
                    ])
                    .buttons([
                        builder.CardAction.postBack(session, "pull_page", "Get the whole page"),
                        builder.CardAction.postBack(session, "pull_tag", "Get value of a tag")
                    ])
            ]);

            // create message
            let msg: any = new builder.Message(session)
                .textFormat(builder.TextFormat.xml)
                .attachments(attachments);

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

        // Get the page
        ipp.getPage(session.userData.pageName, session.userData.folderName).then((res) => {
            session.userData.page = res.data;

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
                    .text("`" + table.toString() + "`"); // .replace(/(?:\r\n|\r|\n)/g, "  \n"")
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

        }, (err) => {
            session.send("Failed to load page");
            session.endDialog();
        });
    }, (session, results) => {
        let tagName: string = results.response;

        let tagVal = ipp.getTagValue(session.userData.page.content, tagName);

        session.userData.tagName = tagName;

        if (typeof tagVal !== "undefined"){
            let msg: any = new builder.Message(session)
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
        } else {
            session.send("This tag does not exist");
        }
    }
]);

bot.beginDialogAction("alert_create", "/alert");

bot.dialog("/alert", [
    (session) => {
        builder.Prompts.text(session,"When would you like me to notify you? Use '<50' or '>50' for example");
    }, (session, results) => {
        let rule: string = results.response;

        session.send("OK, I will let you know when " + session.userData.tagName + " is " + rule);

        alertCollection.watchTag(session.userData.page.domain_id, session.userData.page.id, session.userData.tagName, rule, false, (val) => {
            let msg = new builder.Message()
                .address(session.message.address)
                .text("YO! " + session.userData.tagName + " is " + rule + " ! Current value is " + val);

            bot.send(msg);    
        });

        session.endDialog();    
    }
]);

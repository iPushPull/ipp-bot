import config = require("./config");
import { ipushpull } from "./ipp_api";
import Q = require("q");
import * as events from "events";
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

// @todo NOT HERE!
let accessToken: string;
let refreshToken: string;

class IPushPull extends events.EventEmitter {
    private _username: string;
    private _password: string;

    private _api: IApiService;

    constructor(username: string, password: string) {
        super();

        this._username = username;
        this._password = password;

        this._api = new ipushpull.Api(config.ipushpull.endpoint);

    }

    public auth() {
        return this._api.userLogin({
            email: this._username,
            password: this._password,
        }).then((data) => {
            accessToken = data.data.access_token;
            refreshToken = data.data.refresh_token;
            this._api.accessToken = data.data.access_token;
            console.log("Login", data);
            return true;
        }, (err) => {
            console.log("Could not login!", err);
            return false;
        });
    }

    public getPage(pageName: string, folderName: string) {
        return this._api.getPageByName({ domainId: folderName, pageId: pageName });
    }

    public getDomain(folderName: string) {
        return this._api.getDomainByName(folderName);
    }

    public getDomainPages(folderId: number) {
        return this._api.getDomainPages(folderId);
    }

}

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
        session.beginDialog('/menu');
    },
    function (session, results) {
        // Display menu
        session.beginDialog('/menu');
    },
    function (session, results) {
        // Always say goodbye
        session.send("Ok... See you later!");
    }
]);

bot.dialog('/menu', [
    function (session) {
        builder.Prompts.choice(session, "What would you like to do?", "pull|push");
    },
    function (session, results) {
        if (results.response && results.response.entity != '(quit)') {
            // Launch demo dialog
            session.beginDialog('/' + results.response.entity);
        } else {
            // Exit the menu
            session.endDialog();
        }
    },
    function (session, results) {
        // The menu runs a loop until the user chooses to (quit).
        session.replaceDialog('/menu');
    }
]).reloadAction('reloadMenu', null, { matches: /^menu|show menu/i });

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

bot.dialog('/push', [
    function (session) {
        builder.Prompts.text(session, "Yes or no?");
    },
    function (session, results) {
        session.send("I see that you have entered '%s'. Hmmm.", results.response);
        session.endDialog();
    }
]);

bot.dialog('/pull', [
    function (session) {
        console.log("session data", session.userData);
        // session.send("Pull a public page");
        builder.Prompts.text(session, "What is your folder name?");
    },
    function (session, results) {

        folderName = results.response;

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
                builder.Prompts.choice(session, "What is your page name?", domainPages.join("|"));

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

        let tableOptions: any = {
            style: { border: [] },
        };
        pageName = results.response.entity;

        if (domainPages.indexOf(pageName) == -1) {
            session.send("Page does not exist");
            session.endDialog();
            return;
        }

        session.send("Loading page ...");

        ipp.getPage(pageName, folderName).then((res) => {

            let imageUrl: string = `${config.ipushpull.docs_url}/export/image?pageId=${res.data.id}&config=slack`;

            let table: any = new Table(tableOptions);

            for (let i: number = 0; i < res.data.content.length; i++) {
                table.push(res.data.content[i].map((cell) => {
                    return cell.formatted_value || cell.value;
                }));
            }

            let msg: any;

            // let msg = new builder.Message(session)
            //     .textFormat(builder.TextFormat.xml)
            //     .attachments([
            //         new builder.HeroCard(session)
            //             .title(`${res.data.name}`)
            //             // .text(table.toString())
            //             .images([builder.CardImage.create(session, imageUrl)])
            //     ]);
            // session.send(msg);

            msg = new builder.Message(session)
                // .textFormat(builder.TextFormat.plain)
                .text("`" + table.toString() + "`");
            session.send(msg);
            console.log(table.toString());

            msg = new builder.Message(session)
                .attachments([{
                    contentType: "image/jpeg",
                    contentUrl: imageUrl
                }]);
            session.send(msg);

            session.endDialog();
        }, (err) => {
            session.send("Failed to load page");
            session.endDialog();
        });
        // session.send("You entered '%s'", results.response);
    }
]);


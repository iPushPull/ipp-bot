import config = require("../../config");
import {PageProvider, IPageProvider, IPage} from "./provider";
import Socket = SocketIOClient.Socket;
import * as io from "socket.io-client";
import IDebugger = debug.IDebugger;
import * as merge from "merge";

let debug: IDebugger = require("debug")("ipp:page:ws");

export class PageProviderWS extends PageProvider implements IPageProvider {
    private _page: IPage;
    private _socket: Socket;

    private _metaLoaded: boolean = true; // Dity hack

    private static get SOCKET_EVENT_PAGE_ERROR(): string { return "page_error"; }
    private static get SOCKET_EVENT_PAGE_CONTENT(): string { return "page_content"; }
    private static get SOCKET_EVENT_PAGE_PUSH(): string { return "page_push"; }
    private static get SOCKET_EVENT_PAGE_SETTINGS(): string { return "page_settings"; }
    private static get SOCKET_EVENT_PAGE_DATA(): string { return "page_data"; }
    private static get SOCKET_EVENT_PAGE_USER_JOINED(): string { return "page_user_joined"; }
    private static get SOCKET_EVENT_PAGE_USER_LEFT(): string { return "page_user_left"; }

    public get page(): IPage{ return this._page; }
    public set accessToken(accessToken: string){ this._accessToken = accessToken; }

    constructor(public pageId: number, private _folderId: number, private _accessToken?: string){
        super(pageId);

        this.start();
    }

    public destroy(): void {
        debug("destroying ws provider");
        this.stop();

        super.destroy();
    }

    public start(): void {
        // Connect to socket
        this._socket = this.connect();

        // Register listeners
        this._socket.on("connect", this.onConnect);
        this._socket.on(PageProviderWS.SOCKET_EVENT_PAGE_CONTENT, this.onPageContent);
        this._socket.on(PageProviderWS.SOCKET_EVENT_PAGE_SETTINGS, this.onPageSettings);
        this._socket.on(PageProviderWS.SOCKET_EVENT_PAGE_ERROR, this.onPageError);
        this._socket.on("disconnect", this.onDisconnect);
    }

    public stop(): void {
        this._socket.removeAllListeners();
        this._socket.disconnect();
    }

    public getTagValue(tag: string){
        if (!this._page) {
            return;
        }

        let tagValue: string = undefined;

        for (let i: number = 0; i < this._page.content.length; i++){
            for (let j: number = 0; j < this._page.content[i].length; j++){
                if (this._page.content[i][j].hasOwnProperty("tag") && this._page.content[i][j].tag.indexOf(tag) >= 0){
                    tagValue = this._page.content[i][j].value;
                    break;
                }
            }
        }

        return tagValue;
    }

    private connect(): Socket {
        /*let query: string[] = [
            `access_token=${storage.persistent.get("access_token")}`,
        ];*/

        let query: string[] = [];

        query = query.filter((val: string) => {
            return (val.length > 0);
        });

        return io.connect(`${config.ipushpull.ws_url}/page/${this.pageId}`, {
            query: query.join("&"),
            transports: ["websocket"],
            forceNew: true,
        });
    }

    /**
     * onConnect event action
     */
    private onConnect: any = () => {
        debug("provider connected");

        // Send client info info
        let info: any = {
            ipushpull: {
                client_id: config.ipushpull.client_id,
            },
        };

        this._socket.emit("info", info);

        return;
    };

    /**
     * onDisconnect event action
     */
    private onDisconnect: any = () => {
        debug("provider disconnected");
        return;
    };

    /**
     * onPageContent eent action
     * @param data
     */
    private onPageContent = (data: any): void => {
        this._page = merge.recursive(true, this._page, data);

        // Here we postponing the loaded event because settings normally follow right after
        // @todo This is obviously dirty hack...
        setTimeout(() => {
            this.emit(PageProvider.EVENT_CONTENT_LOADED, this._page);
        }, (!this._metaLoaded) ? 300 : 0);
    };

    /**
     * onPageSettings event action
     * @param data
     */
    private onPageSettings = (data: any): void => {
        this._page = merge.recursive(true, this._page, data);
        this._metaLoaded = true;

        this.emit("meta_update", data);
    };

    /**
     * onPageError event action
     * @param data
     */
    private onPageError = (data: any): void => {
        this.emit(PageProvider.EVENT_ERROR, data);
    };
}
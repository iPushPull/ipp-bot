import config = require("../../config");
import {PageProvider, IPageProvider} from "./provider";
import {IPage} from "./provider";
import { ipushpull } from "../../ipp_api";
import IApiService = ipushpull.IApiService;
import * as Q from "q";
import * as merge from "merge";
import Promise = Q.Promise;
import Deferred = Q.Deferred;
import IDebugger = debug.IDebugger;

let debug: IDebugger = require("debug")("ipp:page:rest");

export class PageProviderREST extends PageProvider implements IPageProvider {
    private _timer: any;
    private _page: IPage;
    private _api: IApiService;

    private _requestOngoing: boolean = false;

    public static get(pageId: number, folderId: number, accessToken?: string): Promise<IPage> {
        let provider: IPageProvider = new PageProviderREST(pageId, folderId, accessToken, undefined, false);
        return provider.latest();
    }

    public static getPageByName(folderName: string, pageName: string, accessToken?: string): Promise<IPage>{
        let api: IApiService = new ipushpull.Api(config.ipushpull.endpoint);
        return api.getPageByName({domainId: folderName, pageId: pageName});
    }

    public get page(): IPage{ return this._page; }
    public set accessToken(accessToken: string){ this._accessToken = accessToken; }

    constructor(public pageId: number, private _folderId: number, private _accessToken?: string, private _interval: number = 10000, autoStart: boolean = true){
        super(pageId);

        this._api = new ipushpull.Api(config.ipushpull.endpoint);

        if (autoStart){
            this.start();
        }
    }

    public start(): void {
        this.load().finally(() => {
            debug("starting interval for polling");
            this._timer = setInterval(() => {
                debug("time for next update");
                this.load();
            }, this._interval);
        });
    }

    public stop(): void {
        if (this._timer){
            debug("clearing poll interval");
            clearInterval(this._timer);
        }
    }

    public latest(): Promise<IPage> {
        return this.load(true);
    }

    public destroy(): void {
        this.stop();

        super.destroy();
    }

    private load(ignoreSeqNo: boolean = false): Promise<IPage> {
        let q: Deferred<IPage> = Q.defer<IPage>();

        // @todo Returning promise, and rejecting before return? need test
        if (this._requestOngoing){
            debug("page %s will not be loaded as it is still waiting for last request to complete", this.pageId);
            q.reject("Request is ongoing");
            return q.promise;
        }

        this._requestOngoing = true;

        debug("page %s loading (seq_no: %s)", this.pageId, ((!ignoreSeqNo && this._page) ? this._page.seq_no : null));

        this._api.getPage({domainId: this._folderId, pageId: this.pageId, seq_no: (this._page) ? this._page.seq_no : 0}).then((res) => {
            this._requestOngoing = false;

            if (res.httpCode === 200 || res.httpCode === 204) {
                let page: IPage;

                // New update
                if (res.httpCode === 200){   
                    let page: IPage = res.data;                 
                    this._page = page;

                    debug("page %s loaded (new version)", page.id);

                    this.emit(PageProvider.EVENT_CONTENT_LOADED, page);
                } else {
                    debug("page %s loaded (no new data)", this.pageId);
                }

                q.resolve(page);
            } else {
                debug("page %s loading error (%s) %s", this.pageId, res.statusCode, res.statusMessage);
                // let httpErr: IHttpError = new HttpError(res.statusCode, res.statusMessage);
                this.emit(PageProvider.EVENT_ERROR, res);
                q.reject(res);
            }            
        }, (err) => {
            this._requestOngoing = false;
            debug("page %s loading error %s", this.pageId, err);
            this.emit(PageProvider.EVENT_ERROR, err);
            q.reject(err);
        });

        return q.promise;
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
}
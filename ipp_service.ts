import * as events from "events";
import { ipushpull } from "./ipp_api";
import config = require("./config");

export class IPushPull extends events.EventEmitter {

    private _accessToken: string;
    private _refreshToken: string;

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
            this._accessToken = data.data.access_token;
            this._refreshToken = data.data.refresh_token;
            this._api.accessToken = data.data.access_token;
        }, (err) => {
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

    public getTagValue(content: any, tag: string){
        let tagValue: string = undefined;

        for (let i: number = 0; i < content.length; i++){
            for (let j: number = 0; j < content[i].length; j++){
                if (content[i][j].hasOwnProperty("tag") && content[i][j].tag.indexOf(tag) >= 0){
                    tagValue = content[i][j].formatted_value || content[i][j].value;
                    break;
                }
            }
        }

        return tagValue;
    }
}
import * as events from "events";
import EventEmitter = NodeJS.EventEmitter;
import * as Q from "q";
import Promise = Q.Promise;

export interface IPage {
    by_name_url: string;
    id: number;                     // x
    name: string;                   // x
    description: string;            // x
    url: string;                    // x
    uuid: string;                   // x
    access_rights: string;          // x
    background_color: string;       // x
    content: any;                   // x
    content_modified_by: any;       // x
    content_modified_timestamp: Date; // x
    created_by: any;
    created_timestamp: Date;        // x
    domain_id: number;              // x
    domain_name: string;            // x
    domain_url: string;             // x
    encrypted_content: string;      // x
    encryption_key_to_use: string;  // x
    encryption_key_used: number;    // x
    encryption_type_to_use: string; // x
    encryption_type_used: number;   // x
    is_obscured_public: boolean;    // x
    is_public: boolean;             // x
    is_template: boolean;           // x
    modified_by: any;
    modified_timestamp: Date;       // x
    pull_interval: number;          // x
    push_interval: number;          // x
    record_history: boolean;        // x
    seq_no: number;                 // x
    show_gridlines: boolean;        // x
    special_page_type: number;      // x
}

export interface IPageProvider extends EventEmitter {
    pageId: number;

    page: IPage;

    start: () => void;
    stop: () => void;
    latest?: () => Promise<IPage>;
    destroy: () => void;
}

export class PageProvider extends events.EventEmitter implements IPageProvider {
    public static get EVENT_CONTENT_LOADED(): string { return "page_content_loaded"; };
    public static get EVENT_SETTINGS_LOADED(): string { return "page_settings_loaded"; };
    public static get EVENT_ERROR(): string { return "page_error"; };

    /**
     * Temporary solution to get the required subset of data from full page object
     *
     * @param data
     * @returns {{id: number, seq_no: number, content_modified_timestamp: Date, content: any, content_modified_by: any, push_interval: number, pull_interval: number, is_public: boolean, description: string, encrypted_content: string, encryption_key_used: number, encryption_type_used: number, special_page_type: number}}
     */
    public static tempGetContentOb(data: IPage): any {
        return {
            id: data.id,
            domain_id: data.domain_id,
            seq_no: data.seq_no,
            content_modified_timestamp: data.content_modified_timestamp,
            content: data.content,
            content_modified_by: data.content_modified_by,
            push_interval: data.push_interval,
            pull_interval: data.pull_interval,
            is_public: data.is_public,
            description: data.description,
            encrypted_content: data.encrypted_content,
            encryption_key_used: data.encryption_key_used,
            encryption_type_used: data.encryption_type_used,
            special_page_type: data.special_page_type,
        };
    }

    /**
     * Temporary solution to get the required subset of data from full page object
     *
     * @param data
     * @returns {any}
     */
    public static tempGetSettingsOb(data: IPage): any {
        return JSON.parse(JSON.stringify(data));
    }

    constructor(public pageId: number){
        super();
    }

    public start(): void { return; }
    public stop(): void { return; }

    public destroy(): void {
        this.removeAllListeners();
    }
}
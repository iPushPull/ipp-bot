import {PageProviderREST} from "../page_provider/provider_rest";
import {PageProviderWS} from "../page_provider/provider_ws";

export class TagAlertCollection {
    private _watchers = [];

    public watchTag(folderId: number, pageId: number, tagName: string, rule: any, alwaysTrigger: boolean = false, callback?: any){
        // Check if we watching that page already
        let watcher = this.findWatcher(pageId);

        if (!watcher){        
            watcher = {
                pageId: pageId,
                provider: null,
                subscriptions: [],
            };

            let provider = new PageProviderREST(pageId, folderId);

            provider.on(PageProviderREST.EVENT_CONTENT_LOADED, (data) => { 
                for(let i: number = 0; i < watcher.subscriptions.length; i++){
                    let tagVal = provider.getTagValue(watcher.subscriptions[i].tag);      

                    console.log("Evaluating: ", "(" + tagVal + watcher.subscriptions[i].rule + ")");                             
                    
                    if (eval("(" + tagVal + watcher.subscriptions[i].rule + ")")){
                        if ((tagVal === watcher.subscriptions[i].lastVal) || (watcher.subscriptions[i].status === "ALARM" && !watcher.subscriptions[i].alwaysTrigger)) {
                            console.log("Preventing alarm trigger");
                            return;
                        }
                             
                        watcher.subscriptions[i].callback(tagVal);
                        watcher.subscriptions[i].status = "ALARM";
                    } else {
                        watcher.subscriptions[i].status = "OK";
                    }

                    watcher.subscriptions[i].lastVal = tagVal;
                }
            });

            watcher.provider = provider;

            this._watchers.push(watcher);
        }

        watcher.subscriptions.push({
            tag: tagName,
            rule: rule,
            callback: callback,
            status: "INIT",
            lastVal: 0,
            alwaysTrigger: alwaysTrigger,
        });
    }

    private findWatcher(pageId: number){
        let watcher;

        for(let i: number; i < this._watchers.length; i++) {
            if(this._watchers[i].pageId === pageId){
                watcher = this._watchers[i];
                break;
            }
        }

        return watcher;
    }
}
"use strict";
var ResumeReason;
(function (ResumeReason) {
    ResumeReason[ResumeReason["completed"] = 0] = "completed";
    ResumeReason[ResumeReason["notCompleted"] = 1] = "notCompleted";
    ResumeReason[ResumeReason["canceled"] = 2] = "canceled";
    ResumeReason[ResumeReason["forward"] = 3] = "forward";
    ResumeReason[ResumeReason["back"] = 4] = "back";
})(ResumeReason = exports.ResumeReason || (exports.ResumeReason = {}));
var Dialog = (function () {
    function Dialog() {
    }
    Dialog.prototype.begin = function (session, args) {
        this.replyReceived(session);
    };
    Dialog.prototype.dialogResumed = function (session, result) {
        if (result.error) {
            session.error(result.error);
        }
    };
    return Dialog;
}());
exports.Dialog = Dialog;

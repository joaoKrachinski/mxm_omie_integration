"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerRoutes = registerRoutes;
const handlers_1 = require("./handlers");
function registerRoutes(app, db, config) {
    const { handleApproverJira, handleVerifyInvoiceJira, handleUpdateOmieJira, handleReprocess, handleHealth } = (0, handlers_1.makeHandlers)(db, config);
    app.post("/approverJira", handleApproverJira);
    app.post("/verifyInvoiceJira", handleVerifyInvoiceJira);
    app.post("/updateOmieJira", handleUpdateOmieJira);
    app.post("/jira/reprocess", handleReprocess);
    app.get("/health", handleHealth);
}
//# sourceMappingURL=routes.js.map
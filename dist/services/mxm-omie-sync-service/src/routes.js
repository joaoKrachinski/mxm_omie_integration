"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerRoutes = registerRoutes;
const handlers_1 = require("./handlers");
function registerRoutes(app, db, config) {
    const { handleSyncOmie, handleReprocess, handleStatus, handleHealth } = (0, handlers_1.makeHandlers)(db, config);
    app.post("/syncOmie", handleSyncOmie);
    app.post("/syncOmie/reprocess", handleReprocess);
    app.get("/syncOmie/status", handleStatus);
    app.get("/health", handleHealth);
}
//# sourceMappingURL=routes.js.map
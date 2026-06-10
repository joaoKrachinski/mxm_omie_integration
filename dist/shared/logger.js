"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createLogger = createLogger;
function log(entry) {
    const level = (process.env.LOG_LEVEL ?? "info");
    const levels = { debug: 0, info: 1, warn: 2, error: 3 };
    if (levels[entry.level] < levels[level])
        return;
    const output = JSON.stringify({ ...entry, timestamp: new Date().toISOString() });
    if (entry.level === "error") {
        console.error(output);
    }
    else {
        console.log(output);
    }
}
function createLogger(serviceName) {
    return {
        info: (message, extra) => log({ level: "info", service_name: serviceName, message, ...extra }),
        warn: (message, extra) => log({ level: "warn", service_name: serviceName, message, ...extra }),
        error: (message, extra) => log({ level: "error", service_name: serviceName, message, ...extra }),
        debug: (message, extra) => log({ level: "debug", service_name: serviceName, message, ...extra }),
    };
}
//# sourceMappingURL=logger.js.map
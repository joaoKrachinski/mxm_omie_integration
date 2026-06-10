"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.genCorrelationId = genCorrelationId;
exports.normalizeCpfCnpj = normalizeCpfCnpj;
exports.toIsoDate = toIsoDate;
exports.buildIdempotencyKey = buildIdempotencyKey;
exports.toValueCents = toValueCents;
const uuid_1 = require("uuid");
function genCorrelationId() {
    return (0, uuid_1.v4)();
}
function normalizeCpfCnpj(value) {
    return value.replace(/\D/g, "");
}
function toIsoDate(date) {
    if (typeof date === "string") {
        return date.substring(0, 10);
    }
    return date.toISOString().substring(0, 10);
}
function buildIdempotencyKey(numeroDocumento, cnpjCpf, valor) {
    return `${numeroDocumento}:${normalizeCpfCnpj(cnpjCpf)}:${valor}`;
}
function toValueCents(value) {
    return Math.round(value);
}
//# sourceMappingURL=utils.js.map
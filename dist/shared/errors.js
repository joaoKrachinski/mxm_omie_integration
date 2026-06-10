"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ConflictError = exports.ValidationError = exports.NotFoundError = exports.AppError = void 0;
class AppError extends Error {
    message;
    statusCode;
    code;
    constructor(message, statusCode = 500, code = "INTERNAL_ERROR") {
        super(message);
        this.message = message;
        this.statusCode = statusCode;
        this.code = code;
        this.name = "AppError";
    }
}
exports.AppError = AppError;
class NotFoundError extends AppError {
    constructor(message) {
        super(message, 404, "NOT_FOUND");
        this.name = "NotFoundError";
    }
}
exports.NotFoundError = NotFoundError;
class ValidationError extends AppError {
    constructor(message) {
        super(message, 400, "VALIDATION_ERROR");
        this.name = "ValidationError";
    }
}
exports.ValidationError = ValidationError;
class ConflictError extends AppError {
    constructor(message) {
        super(message, 409, "CONFLICT");
        this.name = "ConflictError";
    }
}
exports.ConflictError = ConflictError;
//# sourceMappingURL=errors.js.map
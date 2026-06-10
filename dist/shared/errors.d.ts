export declare class AppError extends Error {
    readonly message: string;
    readonly statusCode: number;
    readonly code: string;
    constructor(message: string, statusCode?: number, code?: string);
}
export declare class NotFoundError extends AppError {
    constructor(message: string);
}
export declare class ValidationError extends AppError {
    constructor(message: string);
}
export declare class ConflictError extends AppError {
    constructor(message: string);
}

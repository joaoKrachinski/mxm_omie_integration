export declare function createLogger(serviceName: string): {
    info: (message: string, extra?: Record<string, unknown>) => void;
    warn: (message: string, extra?: Record<string, unknown>) => void;
    error: (message: string, extra?: Record<string, unknown>) => void;
    debug: (message: string, extra?: Record<string, unknown>) => void;
};

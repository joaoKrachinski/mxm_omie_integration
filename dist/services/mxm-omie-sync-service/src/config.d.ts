export declare function loadConfig(): {
    port: number;
    nodeEnv: string;
    logLevel: string;
    timeoutSeconds: number;
    mongodb: {
        uri: string;
        database: string;
        collection: string;
    };
    mxm: {
        baseUrl: string;
        authToken: string;
        syncWindowHours: number;
    };
    omie: {
        baseUrl: string;
        appKey: string;
        appSecret: string;
    };
    slack: {
        botToken: string;
        alertChannel: string;
    };
    gcp: {
        projectId: string;
        region: string;
    };
};
export type Config = ReturnType<typeof loadConfig>;

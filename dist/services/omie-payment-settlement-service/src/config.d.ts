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
    omie: {
        baseUrl: string;
        appKey: string;
        appSecret: string;
        webhookToken: string;
    };
    mxm: {
        baseUrl: string;
        authToken: string;
    };
    jira: {
        baseUrl: string;
        email: string;
        apiToken: string;
    };
    slack: {
        botToken: string;
        alertChannel: string;
    };
    reconciliationSchedule: string;
    gcp: {
        projectId: string;
        region: string;
    };
};
export type Config = ReturnType<typeof loadConfig>;

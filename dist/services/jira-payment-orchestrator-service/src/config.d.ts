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
    jira: {
        baseUrl: string;
        email: string;
        apiToken: string;
    };
    sheets: {
        spreadsheetId: string;
        tabName: string;
        range: string;
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

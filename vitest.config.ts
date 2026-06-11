import { defineConfig } from "vitest/config";
import { resolve } from "path";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["tests/**/*.test.ts"],
    env: {
      NODE_ENV: "test",
      MONGODB_COLLECTION_PAYMENT_INTEGRATIONS: "payment_integrations",
      MXM_BASE_URL: "http://fake-mxm",
      MXM_USERNAME: "fake-user",
      MXM_PASSWORD: "fake-pass",
      MXM_ENVIRONMENT: "test",
      OMIE_BASE_URL: "http://fake-omie",
      OMIE_APP_KEY: "fake-key",
      OMIE_APP_SECRET: "fake-secret",
      JIRA_BASE_URL: "http://fake-jira",
      JIRA_EMAIL: "fake@fake.com",
      JIRA_API_TOKEN: "fake-token",
      SLACK_BOT_TOKEN: "fake-slack-token",
    },
    coverage: {
      provider: "v8",
      include: ["shared/**", "adapters/**", "services/**/src/**"],
    },
  },
  resolve: {
    alias: {
      "@shared": resolve(__dirname, "shared"),
      "@adapters": resolve(__dirname, "adapters"),
      "@database": resolve(__dirname, "database"),
    },
  },
});

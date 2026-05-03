module.exports = {
  apps: [
    {
      name: "auth-service",
      script: "tsx",
      args: "src/services/mock-service.ts",
      env: {
        SERVICE_NAME: "auth-service",
        PORT: "4001",
      },
    },
    {
      name: "payment-service",
      script: "tsx",
      args: "src/services/mock-service.ts",
      env: {
        SERVICE_NAME: "payment-service",
        PORT: "4002",
      },
    },
    {
      name: "notification-service",
      script: "tsx",
      args: "src/services/mock-service.ts",
      env: {
        SERVICE_NAME: "notification-service",
        PORT: "4003",
      },
    },
    // These two crash after 1 minute and are not auto-restarted by PM2
    {
      name: "inventory-service",
      script: "tsx",
      args: "src/services/mock-service.ts",
      autorestart: false,
      env: {
        SERVICE_NAME: "inventory-service",
        PORT: "4004",
        FAIL_AFTER_MS: "60000",
      },
    },
    {
      name: "reporting-service",
      script: "tsx",
      args: "src/services/mock-service.ts",
      autorestart: false,
      env: {
        SERVICE_NAME: "reporting-service",
        PORT: "4005",
        FAIL_AFTER_MS: "60000",
      },
    },
  ],
};

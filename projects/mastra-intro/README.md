# Status Monitor

AI-powered DevOps tool that monitors mock services, detects outages, and lets you chat with an AI agent to check health, restart services, and trigger diagnostic workflows.

## Prerequisites

- Node.js v24 (`nvm use`)
- Yarn (`npm install -g yarn`)
- A `.env` file and fill in your credentials:
  - `OPENAI_API_KEY` - API key for OpenAI ChatGPT models
  - `LLM_MODEL` - model name passed to the provider (e.g. `gpt-4o`)
  - `SLACK_BOT_TOKEN`, `SLACK_TEAM_ID`, and `SLACK_CHANNEL_ID` - for Slack notifications via MCP

## Install

```bash
yarn install
```

## Run

**1. Start the mock services:**

```bash
yarn services:start
```

To check the status of running services:

```bash
yarn services:status
```

This starts 5 HTTP services on ports 4001–4005. Two of them (`inventory-service`, `reporting-service`) begin failing after 1 minute.

**2. Start the API server:**

```bash
yarn dev
```

**3. Open the chatbot UI:**

Navigate to [http://localhost:3000](http://localhost:3000) in your browser.

## Stop

```bash
yarn services:delete   # stops and removes PM2 processes
```

## Example prompts

- `List all the services you can monitor.`
- `Check the health of all services and tell me which ones are down.`
- `Restart the failing ones.` _(follow-up - agent remembers context from the previous message)_
- `Restart auth-service, payment-service, and notification-service at the same time.` _(triggers the guardrail - agent will decline and ask you to pick at most 2)_
- `Run the full service repair workflow.`

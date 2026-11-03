FROM node:22-bookworm-slim AS cli
WORKDIR /opt/agents24
COPY deploy/agents/package*.json ./
RUN npm ci --omit=dev --ignore-scripts

FROM python:3.12-slim-bookworm
RUN apt-get update && apt-get install -y --no-install-recommends gcc libpq-dev && rm -rf /var/lib/apt/lists/*
COPY --from=cli /usr/local/bin/node /usr/local/bin/node
COPY --from=cli /opt/agents24 /opt/agents24
WORKDIR /app
COPY backend/requirements.txt backend/requirements.txt
RUN pip install --no-cache-dir -r backend/requirements.txt
COPY backend /app/backend
COPY agents24 /app/agents24
ENV AGENTS24_DEV_CLI=/opt/agents24/node_modules/@agents24/cli/dist/cli.js
ENV PRYSM_AGENT_PACKAGE_DIR=/app/agents24
WORKDIR /app/backend
CMD ["python", "-m", "agent.relay_host"]

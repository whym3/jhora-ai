# MCP server of the AI astrologer (src/mcp) as a Streamable HTTPS server on port 3443.
# The ephemeris files in public/ephe are JHora's own copies, included in the repository. Saved charts and the message log live in /app/charts: mount a volume
# there to keep them. The TLS certificate and key are mounted at /app/tls, never baked into
# the image (docker-compose.yml mounts ./charts and ./.cache/mcp-tls).
FROM node:22-bookworm-slim AS build
WORKDIR /src
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY vite.mcp.config.ts ./
COPY src ./src
RUN npm run mcp:build

FROM node:22-bookworm-slim
WORKDIR /app
COPY --from=build /src/dist-mcp ./dist-mcp
COPY public/samples ./public/samples
COPY public/ephe ./public/ephe
RUN mkdir -p charts && chown node:node charts
USER node
ENV JHORA_ROOT=/app JHORA_MCP_HOST=0.0.0.0 JHORA_TLS_CERT=/app/tls/cert.pem JHORA_TLS_KEY=/app/tls/key.pem
EXPOSE 3443
CMD ["node", "dist-mcp/jhora-mcp.mjs", "--https=3443"]

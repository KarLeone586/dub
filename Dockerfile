FROM oven/bun:1
WORKDIR /app
COPY . .
RUN mkdir -p /data && bun build-server.mjs
CMD ["sh","-c","printf \"{\\\"token\\\":\\\"%s\\\",\\\"miniAppUrl\\\":\\\"https://dub-production.up.railway.app\\\"}\" \"$BOT_TOKEN\" > bot/config.json && (bun bot/server.ts & bun bot/bot.mjs)"]

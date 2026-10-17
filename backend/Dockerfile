FROM node:22-bookworm-slim
WORKDIR /srv/backend
COPY backend/package*.json ./
RUN npm ci --omit=dev
COPY backend/ ./
COPY app/src/engine.js app/src/boosters.js app/src/recorded-game.js app/src/levels.js app/src/campaign.js app/src/campaign-tuning.js /srv/app/src/
COPY app/package.json /srv/app/package.json
USER node
CMD ["node","server.js"]

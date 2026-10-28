FROM node:24-alpine
WORKDIR /app
COPY package.json ./
RUN npm install --omit=dev
COPY core.js nas.js ./
USER node
CMD ["node", "nas.js"]

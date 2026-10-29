FROM node:24-alpine
WORKDIR /app
COPY core.js server.js aircraftdb.js trains.js nsapi.js ./
# Volume inherits this ownership on first start, so the node user can write
RUN mkdir -p /data && chown node:node /data
USER node
CMD ["node", "server.js"]

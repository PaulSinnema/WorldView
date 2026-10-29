FROM node:24-alpine
WORKDIR /app
COPY core.js server.js aircraftdb.js trains.js nsapi.js ov.js cameras.js air.js nh3.js ozone.js power.js era5.js ./
# Volume inherits this ownership on first start, so the node user can write
RUN mkdir -p /data && chown node:node /data
USER node
CMD ["node", "server.js"]

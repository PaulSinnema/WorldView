FROM node:24-alpine
WORKDIR /app
COPY core.js server.js aircraftdb.js trains.js nsapi.js ov.js cameras.js air.js nh3.js ozone.js power.js gistemp.js coral.js history.js museums.js energy.js plants.js countries.js places.js atcstreams.js airports.js legs.js routes.js ./
# Volumes inherit this ownership on first start, so the node user can write
RUN mkdir -p /data /state && chown node:node /data /state
USER node
CMD ["node", "server.js"]

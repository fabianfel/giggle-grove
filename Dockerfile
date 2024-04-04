FROM node:21-alpine3.18 as frontend

COPY /frontend/.angular           /frontend/.angular
COPY /frontend/src                /frontend/src
COPY /frontend/angular.json       /frontend/angular.json
COPY /frontend/package.json       /frontend/package.json
COPY /frontend/tsconfig.app.json  /frontend/tsconfig.app.json
COPY /frontend/tsconfig.json      /frontend/tsconfig.json
# COPY /frontend/node_modules       /frontend/node_modules
# COPY /frontend/yarn.lock          /frontend/yarn.lock

WORKDIR /frontend
RUN yarn install --network-timeout 1000000
RUN yarn build:production


FROM node:21-alpine3.18 as backend

COPY /backend/server.ts     /backend/server.ts
COPY /backend/package.json  /backend/package.json
# COPY /backend/node_modules  /backend/node_modules
# COPY /backend/yarn.lock     /backend/yarn.lock

WORKDIR /backend
RUN yarn install
RUN yarn build


FROM node:21-alpine3.18 as production

RUN apk update && apk add bash

RUN yarn global add modclean node-prune

COPY /backend/package.json  /package.json
COPY --from=backend /backend/server.js /server.js
COPY --from=frontend /frontend/dist/browser /public

RUN yarn install --production

RUN modclean -n default:safe,default:caution -r && node-prune


FROM node:21-alpine3.18 as final

COPY /backend/prod.env /.env
COPY --from=production /node_modules /node_modules
COPY --from=production /public /public
COPY --from=production /server.js /server.js

EXPOSE 6969

CMD ["node","--experimental-detect-module" ,"server.js"]
FROM node as frontend

COPY /frontend/.angular           /frontend/.angular
COPY /frontend/src                /frontend/src
COPY /frontend/angular.json       /frontend/angular.json
COPY /frontend/package.json       /frontend/package.json
COPY /frontend/tsconfig.app.json  /frontend/tsconfig.app.json
COPY /frontend/tsconfig.json      /frontend/tsconfig.json
COPY /frontend/yarn.lock          /frontend/yarn.lock

WORKDIR /frontend
RUN yarn install
RUN yarn build:production


FROM node as backend

COPY /backend/server.ts     /backend/server.ts
COPY /backend/package.json  /backend/package.json
COPY /backend/yarn.lock     /backend/yarn.lock

WORKDIR /backend
RUN yarn install
RUN yarn build


FROM node as production

RUN yarn global add modclean node-prune

COPY --from=backend /backend/server.js /server.js
COPY --from=frontend /frontend/dist/browser /public
COPY /backend/package.json  /package.json

RUN yarn install --production

RUN modclean -n default:safe,default:caution -r && node-prune


FROM node:21-alpine3.18 as final

COPY /backend/prod.env /.env
COPY --from=production /node_modules /node_modules
COPY --from=production /public /public
COPY --from=production /server.js /server.js

EXPOSE 5000

CMD ["node","--experimental-detect-module" ,"server.js"]
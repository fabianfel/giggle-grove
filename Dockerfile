FROM node as builder

WORKDIR /

COPY /backend/server.ts     /backend/server.ts
COPY /backend/package.json  /backend/package.json
COPY /backend/yarn.lock     /backend/yarn.lock

COPY /frontend/.angular           /frontend/.angular
COPY /frontend/src                /frontend/src
COPY /frontend/angular.json       /frontend/angular.json
COPY /frontend/gulpfile.js        /frontend/gulpfile.js
COPY /frontend/package.json       /frontend/package.json
COPY /frontend/tsconfig.app.json  /frontend/tsconfig.app.json
COPY /frontend/tsconfig.json      /frontend/tsconfig.json
COPY /frontend/yarn.lock          /frontend/yarn.lock

WORKDIR /frontend
RUN yarn install

WORKDIR /backend
RUN yarn install
RUN yarn build


FROM node as production

RUN yarn global add modclean node-prune minify-all

COPY --from=builder /backend/server.js /server.js
COPY --from=builder /backend/public /public
COPY --from=builder /backend/package.json /package.json

RUN yarn install --production


RUN modclean -n default:safe,default:caution -r && node-prune && minify-all


FROM node:21-alpine3.18 as final

COPY --from=production /node_modules /node_modules
COPY --from=production /public /public
COPY --from=production /package.json /package.json
COPY --from=production /server.js /server.js
CMD ["node","--experimental-detect-module" ,"server.js"]
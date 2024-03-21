FROM node as builder

WORKDIR /

COPY /backend /backend
COPY /frontend /frontend

WORKDIR /frontend
RUN yarn

WORKDIR /backend
RUN yarn
RUN yarn build


FROM node as production

RUN yarn global add modclean node-prune minify-all

COPY --from=builder /backend /

RUN yarn install --production

RUN modclean -n default:safe,default:caution -r && node-prune && minify-all


FROM node:21-alpine3.18 as final

COPY --from=production /node_modules /node_modules
COPY --from=production /public /public
COPY --from=production /package.json /package.json
COPY --from=production /server.js /server.js

CMD ["node","--experimental-detect-module" ,"server.js"]
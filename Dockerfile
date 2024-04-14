FROM node:21-alpine3.18 as builder

COPY /frontend/src                /frontend/src
COPY /frontend/angular.json       /frontend/angular.json
COPY /frontend/package.json       /frontend/package.json
COPY /frontend/tsconfig.app.json  /frontend/tsconfig.app.json
COPY /frontend/tsconfig.json      /frontend/tsconfig.json

COPY /backend/src                 /backend/src
COPY /backend/package.json        /backend/package.json
COPY /backend/tsconfig.json       /backend/tsconfig.json
COPY /backend/webpack.config.js   /backend/webpack.config.js

WORKDIR /backend
RUN yarn install
RUN yarn build:all

WORKDIR /final
RUN mv /backend/public ./public
RUN mv /backend/dist/backend.js ./backend.js

# Clean up
RUN rm -rf /frontend /backend


FROM alpine:3.18

# Create app directory
WORKDIR /usr/src/app

# Add required binaries
RUN apk add --no-cache libstdc++ dumb-init \
  && addgroup -g 1000 node && adduser -u 1000 -G node -s /bin/sh -D node \
  && chown node:node ./
COPY --from=builder /usr/local/bin/node /usr/local/bin/
COPY --from=builder /usr/local/bin/docker-entrypoint.sh /usr/local/bin/
ENTRYPOINT ["docker-entrypoint.sh"]
USER node

COPY /backend/prod.env ./.env
COPY --from=builder /final/public ./public
COPY --from=builder /final/backend.js ./backend.js

EXPOSE 6969

CMD ["dumb-init", "node", "--experimental-detect-module" ,"backend.js"]
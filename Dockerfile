FROM node:24-alpine

ENV NODE_ENV=production
WORKDIR /excalidraw-room

# Enable Corepack to use the pinned Yarn version from package.json (packageManager field)
RUN corepack enable

COPY package.json yarn.lock .yarnrc.yml ./
RUN yarn install --immutable

COPY tsconfig.json ./
COPY src ./src
RUN yarn build

FROM node:18-alpine as production
ENV NODE_ENV=production
ENV PM2_HOME=/excalidraw-room-pm2/.pm2

# install pm2:
RUN yarn global add pm2

USER nobody
# create a directory that pm2 can use that's separate from the application:
WORKDIR /excalidraw-room-pm2/

# switch to app directory:
WORKDIR /excalidraw-room

# copy config, app and node_modules:
COPY pm2.production.json /excalidraw-room/
COPY --from=production_buildstage /excalidraw-room/dist /excalidraw-room/dist
COPY --from=production_buildstage /excalidraw-room/node_modules /excalidraw-room/node_modules

EXPOSE 8080

CMD ["pm2-runtime", "--json", "/excalidraw-room/pm2.production.json"]

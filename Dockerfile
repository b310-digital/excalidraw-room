FROM node:20-alpine as development

WORKDIR /excalidraw-room

COPY package.json yarn.lock ./
RUN yarn

FROM node:20-alpine as production_buildstage

WORKDIR /excalidraw-room

COPY package.json yarn.lock ./
RUN yarn

COPY tsconfig.json ./
COPY src ./src
RUN yarn build

FROM node:20-alpine as production
ENV NODE_ENV=production
ENV PM2_HOME=/excalidraw-room-pm2/.pm2

# install pm2:
RUN yarn global add pm2

USER nobody
# create a directory that pm2 can use that's separate from the application:
WORKDIR /excalidraw-room-pm2/

# switch to app directory:
WORKDIR /excalidraw-room

# Install required node modules:
COPY --chown=nobody:nobody package.json yarn.lock ./
RUN yarn install --production && yarn cache clean

# copy config and app:
COPY pm2.production.json /excalidraw-room/
COPY --from=production_buildstage /excalidraw-room/dist /excalidraw-room/dist

EXPOSE 8080

CMD ["pm2-runtime", "/excalidraw-room/pm2.production.json"]

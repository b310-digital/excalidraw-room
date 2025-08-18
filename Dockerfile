FROM node:24-alpine AS development

WORKDIR /excalidraw-room

# Enable Corepack to use the pinned Yarn version from package.json (packageManager field)
RUN corepack enable

COPY package.json yarn.lock ./
RUN yarn

FROM node:24-alpine AS production_buildstage
ENV NODE_ENV=production

WORKDIR /excalidraw-room

# Enable Corepack to use the pinned Yarn version from package.json (packageManager field)
RUN corepack enable && corepack prepare yarn@stable --activate

COPY package.json yarn.lock .yarnrc.yml ./
RUN yarn install --immutable  --frozen-lockfile

COPY tsconfig.json ./
COPY src ./src
RUN yarn build

FROM node:24-alpine AS production
ENV NODE_ENV=production
ENV PM2_HOME=/excalidraw-room-pm2/.pm2

# install pm2:
RUN yarn global add pm2

# Enable Corepack to use the pinned Yarn version from package.json (packageManager field)
RUN corepack enable && corepack prepare yarn@stable --activate

# Create direcotry for pm2:
RUN mkdir -p /excalidraw-room-pm2/ && chown -R nobody:nobody /excalidraw-room-pm2/

# switch to app directory:
WORKDIR /excalidraw-room

# copy config and app:
COPY --chown=nobody:nobody pm2.production.json /excalidraw-room/
COPY --chown=nobody:nobody --from=production_buildstage /excalidraw-room/dist /excalidraw-room/dist
COPY --chown=nobody:nobody --from=production_buildstage /excalidraw-room/node_modules /excalidraw-room/node_modules

USER nobody

CMD ["pm2-runtime", "/excalidraw-room/pm2.production.json"]

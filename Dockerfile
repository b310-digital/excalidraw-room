FROM node:24-alpine

WORKDIR /excalidraw-room

# Enable Corepack to use the pinned Yarn version from package.json (packageManager field)
RUN corepack enable

COPY package.json yarn.lock .yarnrc.yml ./
RUN yarn install --immutable

COPY tsconfig.json ./
COPY src ./src
RUN yarn build

EXPOSE 80
CMD ["yarn", "start"]

FROM node:10.14.0-stretch

RUN npm install -g npm@latest
RUN mkdir /app
RUN chown node:node -R /app
USER node
COPY package.json /app/
COPY package-lock.json /app/
COPY copy-assets.sh /app/
WORKDIR /app/
RUN npm ci

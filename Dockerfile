FROM node:10.14.0-stretch

ARG DEBIAN_FRONTEND=noninteractive
# python dependencies for balrog submitter
RUN apt-get update --no-install-recommends \
  && apt-get install -y \
  python python-pip
RUN pip install \
  awscli==1.15.32 \
  pycrypto==2.6.1 \
  requests==2.18.4

# update npm and prepare dependencies
RUN npm install -g npm@latest
RUN mkdir /app
RUN chown node:node -R /app
USER node
COPY package.json /app/
COPY package-lock.json /app/
COPY copy-assets.sh /app/

# get balrog submitter script
RUN wget -O /app/submitter.py https://raw.githubusercontent.com/cliqz-oss/browser-core/master/fern/submitter.py

WORKDIR /app/
RUN npm ci

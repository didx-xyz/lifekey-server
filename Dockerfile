FROM node:carbon

RUN apt-get update -y && apt-get upgrade -y

RUN mkdir /usr/src/app
RUN mkdir /usr/src/app/lifekey-server

WORKDIR /usr/src/app/lifekey-server

RUN  mkdir /root/.ssh/ && \
    mkdir ./etc && \
    mkdir ./bin && \
    mkdir ./etc/eth && \
    mkdir ./etc/keys && \
    mkdir ./etc/eth/abi


COPY etc/eth/abi/thanks.json etc/eth/abi
COPY etc/keys/*.json etc/keys/

COPY package*.json ./
COPY etc/env/development.env.json etc/env/development.env.json
COPY bin/ bin/
COPY deploy.sh .
RUN chmod +x deploy.sh
RUN ls etc/env/ && cat etc/env/development.env.json

ADD github /root/.ssh/github

COPY src/ src/
RUN sh deploy.sh

CMD ["npm", "start"]
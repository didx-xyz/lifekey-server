FROM lifekey-base:latest

ADD . /app

WORKDIR /app

RUN npm install

CMD ["/bin/bash"]

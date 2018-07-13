FROM ubuntu:16.04

ARG uid=1000

RUN apt-get update && \
    apt-get install -y \
      pkg-config \
      libssl-dev \
      libgmp3-dev \
      curl \
      build-essential \
      libsqlite3-dev \
      cmake \
      git \
      python3.5 \
      python3-pip \
      python-setuptools \
      apt-transport-https \
      ca-certificates \
      debhelper \
      wget \
      devscripts \
      libncursesw5-dev \
      libzmq3-dev \
	    software-properties-common

# install nodejs and npm
RUN curl -sL https://deb.nodesource.com/setup_8.x | bash -
RUN apt-get install -y nodejs

RUN pip3 install -U \
	pip \
	setuptools \
	virtualenv \
	twine \
	plumbum \
	deb-pkg-tools

RUN cd /tmp && \
   curl https://download.libsodium.org/libsodium/releases/libsodium-1.0.14.tar.gz | tar -xz && \
    cd /tmp/libsodium-1.0.14 && \
    ./configure --disable-shared && \
    make && \
    make install && \
    rm -rf /tmp/libsodium-1.0.14

RUN apt-get update && apt-get install openjdk-8-jdk -y
ENV JAVA_HOME /usr/lib/jvm/java-8-openjdk-amd64
RUN apt-get update && apt-get install -y maven

RUN apt-get install -y zip
RUN mkdir /home/indy

RUN curl https://sh.rustup.rs -sSf | sh -s -- -y --default-toolchain 1.26.0
ENV PATH=/root/.cargo/bin:$PATH

WORKDIR /home/indy

RUN mkdir src && cd src && \
    mkdir app && \
    mkdir /root/.ssh/ && \
    mkdir ./app/etc && \
    mkdir ./app/etc/sovrin && \
    mkdir ./app/bin && \
    mkdir ./app/etc/eth && \
    mkdir ./app/etc/eth/abi


WORKDIR /home/indy/src/app
COPY etc/eth/abi/thanks.json etc/eth/abi
COPY package*.json ./
COPY etc/sovrin/docker_pool_transactions_genesis etc/sovrin
#COPY node_modules/ node_modules/
COPY etc/env/docker.env.json etc/env/development.env.json
COPY bin/ bin/
COPY deploy .
RUN chmod +x deploy
RUN ls etc/env/ && cat etc/env/development.env.json

ADD github /root/.ssh/github

WORKDIR /home/indy/src

#1. INDY SDK
# RUN git clone https://github.com/hyperledger/indy-sdk.git && \
#     cd ./indy-sdk/libindy && \
#     cargo build --release && \
#     cp target/release/libindy.so /usr/lib && \
#     cd ../libnullpay && \
#     cargo build --release && \
#     cp target/release/libnullpay.so /usr/lib && \
#     export LD_LIBRARY_PATH="/usr/lib" && \
#     export DYLD_LIBRARY_PATH="/usr/lib" && \
#     cd ../../app


RUN apt-key adv --keyserver keyserver.ubuntu.com --recv-keys 68DB5E88 \
    && add-apt-repository "deb https://repo.sovrin.org/sdk/deb xenial master" \
    && apt-get update \
    && apt-get install -y \
    libindy

WORKDIR /home/indy/src/app 

#2. LIFE KEY CRYPTO
#  RUN cd .. && ssh-keyscan -t rsa github.com > /root/.ssh/known_hosts && eval $(ssh-agent -s) && \
#      ssh-add /root/.ssh/github && \
#      git clone git@github.com:consent-global/lifekey-crypto.git && \
#      git clone git@github.com:consent-global/identity-service-wrapper.git && \
#      cd ./lifekey-crypto  && \
#      npm install && \
#      cd ../identity-service-wrapper  && \
#      npm install

#3. indy-sdk
# RUN npm install indy-sdk
# RUN npm -g config set user root && \
#     cd ../indy-sdk/wrappers/nodejs && \
#     npm install -g sshpk && \
#     npm install uuid && \
#     npm install -g assert-plus && \ 
#     npm run prepare && npm install 

#4. LIFE KEY SERVER
RUN cd /home/indy/src/app
#COPY deploy.sh deploy.sh
RUN chmod +x deploy
COPY src/ src/
RUN sh deploy
#RUN ssh-keyscan -t rsa github.com > /root/.ssh/known_hosts && eval $(ssh-agent -s) && \
 #   ssh-add /root/.ssh/github && \
    #npm install -g uuid && \
  #  npm install

#RUN useradd -ms /bin/bash -u $uid indy

#USER indy

# EXPOSE 80
# EXPOSE 8443
# EXPOSE 3000
# EXPOSE 8545
#CMD ["npm", "start"]
#
CMD ["npm", "start"]



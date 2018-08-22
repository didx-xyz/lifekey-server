FROM ubuntu:16.04

ARG user=indy
ARG uid=1001
ENV HOME="/home/$user"
WORKDIR $HOME
RUN mkdir -p .local/bin .local/etc .local/lib

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

ARG nacl_lib_ver=1.0.16

# Build and install libsodium library
RUN curl -o libsodium-${nacl_lib_ver}.tar.gz \
        "https://download.libsodium.org/libsodium/releases/libsodium-${nacl_lib_ver}.tar.gz" && \
    tar xzvf libsodium-${nacl_lib_ver}.tar.gz && \
    cd libsodium-${nacl_lib_ver} && \
    CFLAGS="-Os" ./configure && \
    make install && \
    cd .. && \
    cp -a /usr/local/lib/libsodium.so* "$HOME/.local/lib" && \
    rm -rf libsodium-${nacl_lib_ver}*

# Add indy user
RUN useradd -U -ms /bin/bash -u $uid $user

RUN apt-key adv --keyserver keyserver.ubuntu.com --recv-keys 68DB5E88 \
    && add-apt-repository "deb https://repo.sovrin.org/sdk/deb xenial master" \
    && apt-get update \
    && apt-get install -y \
    libindy


#COPY --chown=indy:indy bin/ $HOME/.local/bin/
#RUN chmod ug+rwx $HOME/.local/bin/*

# Support standard python paths used in scripts
# ENV PYENV_ROOT="$HOME/.pyenv"
# RUN ln -s "$PYENV_ROOT/shims/python" /usr/bin/python && \
#     ln -s "$PYENV_ROOT/shims/python3" /usr/bin/python3 && \
#     ln -s "$PYENV_ROOT/shims/pip" /usr/bin/pip && \
#     ln -s "$PYENV_ROOT/shims/pip3" /usr/bin/pip3

# Add selected version of python and local bin directories
#ENV PATH="$HOME/.local/bin:$HOME/bin:$PYENV_ROOT/shims:$PYENV_ROOT/bin:$PATH"

# Make libraries resolvable by python
ENV LD_LIBRARY_PATH="$HOME/.local/lib:$LD_LIBRARY_PATH"

USER $user

CMD ["bash"]
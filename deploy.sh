#!/usr/bin/env bash
ssh-keyscan -t rsa github.com > /root/.ssh/known_hosts
eval $(ssh-agent -s)
ssh-add /root/.ssh/github
npm install
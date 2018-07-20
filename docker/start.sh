#!/bin/bash
CURRENT_DIR=`dirname $0`
ROOT_DIR=$CURRENT_DIR/..
echo "***********************************"
echo "* LIFEKEY SERVER                  *"
echo "***********************************"
docker-compose up -d
$ROOT_DIR/docker/wait-for-service.sh lifekey-mysql 'waiting for mysql to start' 10
docker cp $CURRENT_DIR/LifeKey.sql lifekey-mysql:/tmp/
docker exec lifekey-mysql /bin/sh -c 'mysql -uroot -plifekey </tmp/LifeKey.sql'
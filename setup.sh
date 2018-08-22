#!/bin/bash

echo "***********************************"
echo "*       CONSENT PDS START         *"
echo "***********************************"
echo ""
docker build -t trustlab/consent ../.

docker-compose up --no-start
docker-compose start mongo
docker-compose start consent_app

echo -n "Starting app ..."
sleep 5
docker-compose logs --tail 130 consent_app
echo ""
echo "***********************************"
echo "*         START COMPLETE          *"
echo "***********************************"
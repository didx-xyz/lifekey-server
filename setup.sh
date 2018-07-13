#!/bin/bash
echo "***********************************"
echo "*      LIFEQI SERVER SETUP        *"
echo "***********************************"
echo ""
echo "Build the LifeQi Server" 
docker build -t trustlab/consent .
docker-compose up --no-start
docker-compose start db
#docker-compose start geth
docker-compose start indy_pool

sleep 10
docker-compose start app
echo "Creating LIFEKEY ..."
sleep 5
echo
echo "Creating LIFEKEY ...done"
docker-compose logs --tail 20 app

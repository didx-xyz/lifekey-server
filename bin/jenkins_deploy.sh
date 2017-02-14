#!/usr/bin/env sh

# deployment script

if [ "$GIT_BRANCH" = "origin/develop" ]; then
  TARGET="130.211.78.173"
  SERVER_ENV=staging
  echo "building for staging environment $TARGET"
elif [ "$GIT_BRANCH" = "origin/master" ]; then
  TARGET=production
  SERVER_ENV=production
  echo "production environment does not yet exist, exiting..."
  exit 0
else
  echo "no environment exists for $GIT_BRANCH, exiting..."
  exit 0
fi

DONT_CHECK_KEYS="-oStrictHostKeyChecking=no"

# copy over upstart services and virtualhost configuration
scp "$DONT_CHECK_KEYS" -r "$WORKSPACE/etc/init" "root@$TARGET:/etc/init"
scp "$DONT_CHECK_KEYS" -r "$WORKSPACE/etc/nginx/$SERVER_ENV/$SERVER_ENV.api.lifekey.cnsnt.io" "root@$TARGET:/etc/nginx/sites-available"

# copy over source code
scp "$DONT_CHECK_KEYS" -r "$WORKSPACE" "root@$TARGET:/srv/$SERVER_ENV.api.lifekey.cnsnt.io"

# restart the service once everything has been replaced
ssh "$DONT_CHECK_KEYS" "root@$TARGET" "service lifekey-server restart"
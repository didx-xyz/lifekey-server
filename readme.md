
# lifekey

## running

- ensure you have docker installed
- `cp ect/env/blank.env.json etc/env/development.env.json`
- `nano etc/env/development.env.json`
- `npm install`
- `npm run db:update && npm run db:start && sleep 10`
- `npm run db:reset && npm test && echo "GOTIME"`

## todos

```c
// TODO add parameter for specify a signing key alias to use in a request
// TODO add perf metrics to each service (http worker, did, notifier, sendgrid)
// TODO nginx rate limiting
// TODO error codes for clients
// TODO runtime options for hosting eis and notification service ourselves or specifying respective hostnames for services
// TODO memoise app activation check results per user and worker
// TODO remove `to_id` fallbacks once eis service calls are in place
// FIXME refactor sqlize models to have associations
// TODO find a new unique id system (cuid is not collision prone, but exposes sensitive information that would make the identifiers easier to guess)
// TODO JSON.parse on large json(ld) documents and files embedded in json are going to bring us to a halt (switch to streaming json parser and real http uploads)
// TODO remap the model instances on the express object - single assignment
// TODO log user agent, remote address and last activity times for phone client
```
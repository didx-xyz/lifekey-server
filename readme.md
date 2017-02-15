
# lifekey

## running

- `cp ect/env/blank.env.json etc/env/dev.env.json && nano etc/env/dev.env.json`
- `npm install`
- `npm run db:drop && npm run db:create`
- `npm test && NODE_ENV=dev npm start`

## todos

```c
// TODO runtime options for hosting eis and notification service ourselves or specifying respective hostnames for services
// TODO remove ursa and secp256k1 libraries and use node's impln instead
// TODO change push_notification worker to query user device id itself
// TODO memoise app activation check results per user and worker
// TODO remove `to_id` fallbacks once eis service calls are in place
// TODO see source files for more todos
// TODO refactor sqlize models to have associations - this will permit eager loading of related records
// TODO find a new unique id system (cuid is not collision prone, but exposes sensitive information that would make the identifiers easier to guess)
// TODO JSON.parse on large json(ld) documents and files embedded in json are going to bring us to a halt (switch to streaming json parser and real http uploads)
// TODO remap the model instances on the express object - single assignment
// TODO log user agent, remote address and last activity times for phone client
```

# lifekey

## running

- `cp ect/env/blank.env.json etc/env/development.env.json && nano etc/env/development.env.json`
- **(skip if hosting own sql database)** get a `keyfile` from ant and store in `etc/keys`
- **(skip if hosting own sql database)** download `cloud_sql_proxy` (vendored by google)
- **(skip if hosting own sql database)** ```bash
  ./bin/cloud_sql_proxy -credential_file=etc/keys/$YOUR_KEYFILE -instances=vivid-case-125013:europe-west1:lifekey=tcp:3306
  ```
- `npm install`
- `git status` to ensure you've not modified the index, otherwise bail out and tell ant what isn't ignored by git that should be
- `npm run db:drop && npm run db:create`
- `npm test && NODE_ENV=development npm start`

## todos

```c
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
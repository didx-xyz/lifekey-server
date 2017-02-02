
# lifekey

## unavoidable overhead

- `JSON.parse` large documents (switch to streaming parser eventually?)

## running

- get a `keyfile` from ant and store in `etc/keys`
- download `cloud_sql_proxy` (vendored by google)
- `./bin/cloud_sql_proxy -credential_file=etc/keys/$YOUR_KEYFILE -instances=vivid-case-125013:europe-west1:lifekey=tcp:3306`
- `npm install`
- `git status` to ensure you've not modified the index, otherwise bail out and tell ant what isn't ignored by git that should be
- `npm run db:drop && npm run db:create`
- `npm test && NODE_ENV=development npm start`

## todos

- change push_notification worker to query user device id itself
- memoise app activation check results per user and worker
- remove `to_id` fallbacks once eis service calls are in place
- see source files for more todos
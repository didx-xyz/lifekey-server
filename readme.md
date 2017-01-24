
# lifekey

- [cloud_sql_proxy](https://cloud.google.com/sql/docs/mysql-connect-proxy)

> If FCM is critical to the Android app's function, be sure to set minSdkVersion 8 or higher in the app's build.gradle. This ensures that the Android app cannot be installed in an environment in which it could not run properly.(https://firebase.google.com/docs/cloud-messaging/android/client)

- restructure models to have associations

## running

- get a `keyfile` from ant
- `./bin/cloud_sql_proxy -credential_file=$YOUR_KEYFILE -instances=vivid-case-125013:europe-west1:lifekey=tcp:3306`
- `npm start`
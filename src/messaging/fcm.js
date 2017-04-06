
'use strict'

var admin = require('firebase-admin')

var env = require('../init/env')()

admin.initializeApp({
  credential: admin.credential.cert(env.FCM_SERVICE_ACCOUNT_KEY),
  databaseURL: env.FCM_DATABASE_URL
})

module.exports = admin.messaging()
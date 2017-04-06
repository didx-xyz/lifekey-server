
'use strict'

var path = require('path')

var env

function load(refresh) {
  if (env && !refresh) return env
  var NODE_ENV = process.env.NODE_ENV || 'development'
  try {
    env = require(`../../etc/env/${NODE_ENV}.env.json`)
  } catch (e) {
    // ENOENT
    throw new Error(`unable to find matching env file for ${NODE_ENV}`)
  }

  try {
    env.EIS_SIGNER_KEY = require(
      path.isAbsolute(env.EIS_SIGNER_KEY) ?
      env.EIS_SIGNER_KEY :
      path.normalize(`${__dirname}/../../${env.EIS_SIGNER_KEY}`)
    ).private_key
    env.EIS_ADMIN_KEY = require(
      path.isAbsolute(env.EIS_ADMIN_KEY) ?
      env.EIS_ADMIN_KEY :
      path.normalize(`${__dirname}/../../${env.EIS_ADMIN_KEY}`)
    ).private_key
  } catch (e) {
    throw new Error('unable to load private keys for eis registry: ' + e)
  }

  try {
    env.FCM_SERVICE_ACCOUNT_KEY = require(
      path.isAbsolute(env.FCM_SERVICE_ACCOUNT_KEY) ?
      env.FCM_SERVICE_ACCOUNT_KEY :
      path.normalize(`${__dirname}/../../${env.FCM_SERVICE_ACCOUNT_KEY}`)
    )
  } catch (e) {
    throw new Error('unable to load fcm server key ' + e)
  }

  env.NODE_ENV = NODE_ENV
  env._ = process.env._
  return env
}

module.exports = load
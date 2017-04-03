
'use strict'

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
    env.EIS_SIGNER_KEY = require(env.EIS_SIGNER_KEY).private_key
    env.EIS_ADMIN_KEY = require(env.EIS_ADMIN_KEY).private_key
  } catch (e) {
    throw new Error('unable to load private keys for eis registry')
  }

  env.NODE_ENV = NODE_ENV
  env._ = process.env._
  return env
}

module.exports = load
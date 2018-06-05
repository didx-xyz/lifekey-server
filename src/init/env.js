
'use strict'

var path = require('path')

var NODE_ENV = process.env.NODE_ENV || 'development'
var env_path = `../../etc/env/${NODE_ENV}.env.json`
var etc_keys_path = `${__dirname}/../../`
var env

module.exports = function(refresh) {
  if (env && !refresh) return env

  var invalidated = delete require.cache[require.resolve(env_path)]
  if (!invalidated) throw new Error('failed to delete cached env data')

  try {
    env = require(env_path)
  } catch (e) {
    if (e.code !== 'MODULE_NOT_FOUND') {
      throw new Error(`unexpected error requiring env data: ${e.code}`)
    }
    throw new Error(`unable to find matching env file for ${NODE_ENV}`)
  }

  try {
    env.EIS_SIGNER_KEY = require(
      path.isAbsolute(env.EIS_SIGNER_KEY) ?
      env.EIS_SIGNER_KEY :
      path.normalize(`${etc_keys_path}/${env.EIS_SIGNER_KEY}`)
    ).private_key
    env.EIS_ADMIN_KEY = require(
      path.isAbsolute(env.EIS_ADMIN_KEY) ?
      env.EIS_ADMIN_KEY :
      path.normalize(`${etc_keys_path}/${env.EIS_ADMIN_KEY}`)
    ).private_key
    env.ISA_RECEIPT_KEY = require(
      path.isAbsolute(env.ISA_RECEIPT_KEY) ?
      env.ISA_RECEIPT_KEY :
      path.normalize(`${etc_keys_path}/${env.ISA_RECEIPT_KEY}`)
    ).private_key
  } catch (e) {
    throw new Error(`unable to load private keys for eis registry: ${e.toString()}`)
  }

  env.NODE_ENV = NODE_ENV
  env._ = process.env._
  return env
}

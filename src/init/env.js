
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
    env.ISA_RECEIPT_KEY = require(
      path.isAbsolute(env.ISA_RECEIPT_KEY) ?
      env.ISA_RECEIPT_KEY :
      path.normalize(`${__dirname}/../../${env.ISA_RECEIPT_KEY}`)
    ).private_key
  } catch (e) {
    throw new Error('unable to load private keys for eis registry: ' + e.toString())
  }

  env.NODE_ENV = NODE_ENV
  env._ = process.env._
  return env
}

module.exports = load
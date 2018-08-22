
'use strict'

var path = require('path')

var NODE_ENV = process.env.NODE_ENV || 'development'
var env_path = `../../etc/env/${NODE_ENV}.env.json`
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

  env.NODE_ENV = NODE_ENV
  env._ = process.env._
  return env
}

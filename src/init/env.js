
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
  env.NODE_ENV = NODE_ENV
  return env
}

module.exports = load
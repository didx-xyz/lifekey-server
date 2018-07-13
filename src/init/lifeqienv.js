
'use strict'


var NODE_ENV = process.env.NODE_ENV || 'development'
var path = require('path')
var etc_env_path = `${__dirname}/../../`
var env_path = `../../etc/env/${NODE_ENV}.env.json`
var env

module.exports = async function(refresh) {
  if (env && !refresh) return env

  try {
    env = require(env_path)
    env.NODE_ENV = NODE_ENV
    env._ = process.env._

//    console.log(`###############${JSON.stringify(process.env)}################################`)
  } catch (e) {
    if (e.code !== 'MODULE_NOT_FOUND') {
      throw new Error(`unexpected error requiring env data: ${e.code}`)
    }
    throw new Error(`unable to find matching env file for ${NODE_ENV}`)
  }
  env.GENESIS_FILE = path.isAbsolute(env.GENESIS_FILE) ? 
                     env.GENESIS_FILE : 
                     path.normalize(`${etc_env_path}/${env.GENESIS_FILE}`)
  return env
}

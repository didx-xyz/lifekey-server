
'use strict'

var fs = require('fs')
var path = require('path')

var sqlize = require('sequelize')

var env, instance

try {
  env = require(`../../etc/env/${process.env.NODE_ENV}.env.json`)
} catch (e) {
  // ENOENT
  throw new Error(`unable to find matching env file for ${process.env.NODE_ENV}`)
}

module.exports = function(logging) {
  return new Promise(function(resolve, reject) {
    if (instance) return resolve(instance)
    // memoise the connection and model definitions
    instance = {
      db: new sqlize(
        env.MYSQL_DATABASE,
        env.MYSQL_USER,
        env.MYSQL_PASSWORD,
        {
          host: 'localhost',
          dialect: 'mysql',
          logging: logging === false ? false : console.log.bind(console)
        }
      )
    }
    
    instance.db.authenticate().then(function() {
      
      // we're in...
      // initialise all table models!
      
      instance.models = {}
      fs.readdir(`${__dirname}/../models`, function(err, files) {
        if (err) return reject(err)
        files.forEach(function(file) {
          instance.models[
            path.basename(file, '.js')
          ] = require(
            `../models/${file}`
          )(instance.db, sqlize)
        })
        return resolve(instance)
      })
    }).catch(reject)
  })
}
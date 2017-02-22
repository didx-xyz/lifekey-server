
// TODO move this file to src/models/index.js

'use strict'

var fs = require('fs')
var path = require('path')

var sqlize = require('sequelize')

var env = require('./env')()

var instance

// TODO make less ghetto with kwargs
// TODO maybe add option for specific model loading (would help speed up tests and boot speed and footprint for workers using few models)
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
      // initialise all the table models
      instance.models = {}
      fs.readdir(`${__dirname}/../models`, function(err, files) {
        if (err) return reject(err)
        files.filter(function(file) {
          return file !== 'index.js'
        }).forEach(function(file) {
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
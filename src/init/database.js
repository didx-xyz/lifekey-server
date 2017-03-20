
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
      ),
      errors: function(err) {
        if (err instanceof sqlize.ValidationError) {
          // message | string | An error message
          // type | string | The type of the validation error
          // path | string | The field that triggered the validation error
          // value | string | The value that generated the error
          var validation_errors = []
          for (var i = 0, len = err.errors.length; i < len; i++) {
            validation_errors.push({
              message: err.errors[i].message,
              type: err.errors[i].type,
              path: err.errors[i].path,
              value: err.errors[i].value
            })
          }
          err.status = 400
          err.message = 'validation error'
          err.body = {
            code: 'todo',
            validation_errors: validation_errors
          }
        }
        
        if (err instanceof sqlize.UniqueConstraintError ||
            err instanceof sqlize.ForeignKeyConstraintError ||
            err instanceof sqlize.ExclusionConstraintError) {
          err.status = 400
          err.message = 'unique constraint error'
          err.body = {
            code: 'todo',
            fields: err.fields,
            index: err.index,
            value: err.value
          }
        }
        
        if (err instanceof sqlize.TimeoutError ||
            err instanceof sqlize.ConnectionRefusedError ||
            err instanceof sqlize.AccessDeniedError ||
            err instanceof sqlize.HostNotFoundError ||
            err instanceof sqlize.HostNotReachableError ||
            err instanceof sqlize.InvalidConnectionError ||
            err instanceof sqlize.ConnectionTimedOutError ||
            err instanceof sqlize.InstanceError) {
          err.status = 503
          err.message = 'service unavailable'
          err.body = {code: 'todo'}
        }
        
        return err
      }
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
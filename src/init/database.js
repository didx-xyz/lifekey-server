
// TODO move this file to src/models/index.js

'use strict'

var fs = require('fs')
var path = require('path')

var sqlize = require('sequelize')

var env = require('./lifeqienv')()

var instance

// TODO make less ghetto with kwargs
// TODO maybe add option for specific model loading (would help speed up tests and boot speed and footprint for workers using few models)
module.exports = function(logging) {
  return new Promise(function(resolve, reject) {
    if (instance) return resolve(instance)
    instance = {
      db: new sqlize(
        process.env.MYSQL_DATABASE,
        process.env.MYSQL_USER,
        process.env.MYSQL_PASSWORD,
        {
          host: process.env.MYSQL_SERVER || 'localhost',
          port: process.env.MYSQL_PORT || 3306,
          dialect: 'mysql',
          logging: logging === false ? false : console.log.bind(console)
        }
      ),
      errors: function(err) {

        var e = {
          error: err.error,
          status: err.status,
          message: err.message,
          body: err.body
        }

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
              field: err.errors[i].path
            })
          }
          e.status = 400
          e.message = 'validation error'
          e.body = {
            code: 'e_field_violation',
            validation_errors: validation_errors
          }
        }

        if (err instanceof sqlize.UniqueConstraintError ||
            err instanceof sqlize.ForeignKeyConstraintError ||
            err instanceof sqlize.ExclusionConstraintError) {
          e.status = 400
          e.message = 'constraint violation error'
          e.body = {
            code: 'e_constraint_violation',
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
          e.status = 503
          e.message = 'service unavailable'
          e.body = {code: 'e_service_unavailable'}
        }

        return e
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

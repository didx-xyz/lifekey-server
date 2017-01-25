
'use strict'

process.on('message', function(message) {
  if (typeof message.did_service_ready === 'boolean') {
    console.log('SLAVE updating DID service availability to', (
      message.did_service_ready ?
      'AVAILABLE' :
      'UNAVAILABLE'
    ))
    server.set('did_service_ready', message.did_service_ready)
  }
})

var fs = require('fs')
var NODE_ENV = process.env.NODE_ENV || 'development'
var env

try {
  env = require(`../../etc/env/${NODE_ENV}.env.json`)
} catch (e) {
  // ENOENT
  throw new Error(`unable to find matching env file for ${NODE_ENV}`)
}

var cors = require('cors')
var morgan = require('morgan')
var bodyParser = require('body-parser')
var express = require('express')

var TESTING = NODE_ENV === 'testing' || !!~(process.env._ || '').indexOf('istanbul')

var server = express()

if (!TESTING && NODE_ENV === 'development') server.use(morgan('dev'))

server.use(cors())
server.use(bodyParser.json())

require('./database')(
  false // disable logging
).then(function(database) {
  
  // attach database connection and models
  var {db, models} = database
  server.set('db', db)
  server.set('models', models)
  
  // TODO
  // mount middlewares here ---

  fs.readdir(`${__dirname}/../routes`, function(err, files) {
    if (err) {
      console.log('unable to enumerate routes', err)
      process.exit(1)
    }
    files.map(function(file) {
      return require(`../routes/${file}`)
    }).reduce(function(prev, curr) {
      return prev.concat(curr)
    }).forEach(function(route) {
      server[route.method](
        route.uri,
        route.callback.bind(server) // we dynamically bind to `server` to allow
                                    // lookups on `this` in route callbacks
      )
    })
  })

  // 404 route
  server.use(function(err, req, res, next) {
    res.status(404)
    return res.json({
      status: 404,
      error: true,
      message: 'not found'
    })
  })

  // and finally, attach
  server.listen(env.WEB_PORT, function() {
    process.send({ready: true})
  })
}).catch(function(err) {
  console.log('db init error', err)
  process.exit(1)
})

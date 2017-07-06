
'use strict'

process.on('message', function(message) {

  if (Array.isArray(message)) {
    // to support fluster data messages

    for (var i = 0, len = message.length; i < len; i++) {
      // process message
    }
  }

  if (message.shutdown) {
    console.log('received a shutdown signal from cluster master')
    http_server.close(function() {
      console.log('requests drained, shutting down...')
      process.send({shutdown: true})
    })
  }

  if (typeof message.sms_otp_service_ready === 'boolean') {
    console.log('SLAVE updating sms_otp service availability to', (
      message.sms_otp_service_ready ?
      '[AVAILABLE]' :
      '[UNAVAILABLE]'
    ))
    server.set('sms_otp_service_ready', message.sms_otp_service_ready)
  }

  if (typeof message.web_auth_signer_service_ready === 'boolean') {
    console.log('SLAVE updating web_auth_signer service availability to', (
      message.web_auth_signer_service_ready ?
      '[AVAILABLE]' :
      '[UNAVAILABLE]'
    ))
    server.set('web_auth_signer_service_ready', message.web_auth_signer_service_ready)
  }
  if (typeof message.did_service_ready === 'boolean') {
    console.log('SLAVE updating DID service availability to', (
      message.did_service_ready ?
      '[AVAILABLE]' :
      '[UNAVAILABLE]'
    ))
    server.set('did_service_ready', message.did_service_ready)
  }
  if (typeof message.notifier_service_ready === 'boolean') {
    console.log('SLAVE updating notifier service availability to', (
      message.notifier_service_ready ?
      '[AVAILABLE]' :
      '[UNAVAILABLE]'
    ))
    server.set('notifier_service_ready', message.notifier_service_ready)
  }
  if (typeof message.sendgrid_service_ready === 'boolean') {
    console.log('SLAVE updating sendgrid service availability to', (
      message.sendgrid_service_ready ?
      '[AVAILABLE]' :
      '[UNAVAILABLE]'
    ))
    server.set('sengrid_service_ready', message.sendgrid_service_ready)
  }
  if (typeof message.vc_generator_service_ready === 'boolean') {
    console.log('SLAVE updating vc_generator service availability to', (
      message.vc_generator_service_ready ?
      '[AVAILABLE]' :
      '[UNAVAILABLE]'
    ))
    server.set('vc_generator_service_ready', message.vc_generator_service_ready)
  }
  if (typeof message.isa_ledger_service_ready === 'boolean') {
    console.log('SLAVE updating isa_ledger service availability to', (
      message.isa_ledger_service_ready ?
      '[AVAILABLE]' :
      '[UNAVAILABLE]'
    ))
    server.set('isa_ledger_service_ready', message.isa_ledger_service_ready)
  }
})

var fs = require('fs')

var env = require('./env')()

var cors = require('cors')
var morgan = require('morgan')
var bodyParser = require('body-parser')
var express = require('express')

var preflight = require('../middlewares/preflight')
var notFound = require('../middlewares/not-found')

var TESTING = (
  env.NODE_ENV === 'testing' ||
  !!~(process.env._ || '').indexOf('istanbul')
)

var server = express()
var http_server

server.enable('trust proxy')

if (!TESTING && env.NODE_ENV !== 'production') server.use(morgan('dev'))

server.use(cors())

// HACK
// binary data exchange mechanism needs to
// be changed as this surely allocates
// gigantic buffers
server.use(bodyParser.json({limit: '50mb'}))

require('./database')(
  false // disable logging
).then(function(database) {
  
  // attach database connection and models
  var {db, models, errors} = database
  server.set('env', env)
  server.set('db', db)
  server.set('db_errors', errors)
  server.set('models', models)
  
  // enumerate all routes
  fs.readdir(`${__dirname}/../routes`, function(err, files) {
    if (err) {
      console.log('unable to enumerate routes', err)
      process.exit(1)
    }
    
    // load them and attach to express instance
    files.map(function(file) {
      return require(`../routes/${file}`)
    }).reduce(function(prev, curr) {
      return prev.concat(curr)
    }).forEach(function(route) {
      server.set( // set whether user must have app activated to invoke route
        `active_${route.method.toLowerCase()}_${route.uri}`,
        route.active || false
      )
      server.set( // set whether user must authenticate to invoke route
        `secure_${route.method.toLowerCase()}_${route.uri}`,
        route.secure || false
      )
      server[route.method](
        route.uri,
        preflight.bind(server),
        route.callback.bind(server)
      )
    })
  })

  // 404 route
  server.use(notFound.bind(server))

  // and finally, attach
  http_server = server.listen(env.WEB_PORT, function() {
    process.send({ready: true})
    if (env.DEBUG_BLOCKING) {
      var blocked = require('blocked')
      blocked(function(ms) {
        console.log('event loop blocked for', ms)
      })
    }
  })
}).catch(function(err) {
  console.log('db init error', err)
  process.exit(1)
})

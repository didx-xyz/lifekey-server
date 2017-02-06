
'use strict'

process.on('message', function(message) {

  if (Array.isArray(message)) {
    // to support fluster data messages

    for (var i = 0, len = message.length; i < len; i++) {
      // process message
    }
  }

  if (typeof message.did_service_ready === 'boolean') {
    console.log('SLAVE updating DID service availability to', (
      message.did_service_ready ?
      '[AVAILABLE]' :
      '[UNAVAILABLE]'
    ))
    server.set('did_service_ready', message.did_service_ready)
  } else if (typeof message.notifier_service_ready === 'boolean') {
    console.log('SLAVE updating notifier service availability to', (
      message.notifier_service_ready ?
      '[AVAILABLE]' :
      '[UNAVAILABLE]'
    ))
    server.set('notifier_service_ready', message.notifier_service_ready)
  } else {
    // otherwise, nothing doing
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

var ensureAppActivationLinkClicked = require('../middleware/ensure-app-activation-link-clicked')
var ensureRequiredHeadersPresent = require('../middlewares/ensure-required-headers-present')
var mitigateReplayAttack = require('../middlewares/mitigate-replay-attack')
var verifySignature = require('../middlewares/verify-signature')
var notFound = require('../middlewares/not-found')

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
  
  // attach app activation middleware
  server.use(ensureAppActivationLinkClicked.bind(server))

  // attach authentication middleware
  server.use(ensureRequiredHeadersPresent.bind(server))
  server.use(mitigateReplayAttack.bind(server))
  server.use(verifySignature.bind(server))

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
        `active_${route.method}_${route.uri}`,
        route.active
      )
      server.set( // set whether user must authenticate to invoke route
        `secure_${route.method}_${route.uri}`,
        route.secure
      )
      server[route.method](
        route.uri,
        route.callback.bind(server)
      )
    })
  })

  // 404 route
  server.use(notFound.bind(server))

  // and finally, attach
  server.listen(env.WEB_PORT, function() {
    process.send({ready: true})
    
    
    if (env.DEBUG_BLOCKING) {
      var blocked = require('blocked')
      blocked(function(ms) {
        console.log('blocked for', ms)
      })
    }

  })
}).catch(function(err) {
  console.log('db init error', err)
  process.exit(1)
})

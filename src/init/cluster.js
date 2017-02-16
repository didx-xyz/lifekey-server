
'use strict'

var fs = require('fs')
var os = require('os')
var cp = require('child_process')

var cluster = require('fluster')

var NODE_ENV = process.env.NODE_ENV || 'development'
var env

try {
  env = require(`../../etc/env/${NODE_ENV}.env.json`)
} catch (e) {
  // ENOENT
  throw new Error(`unable to find matching env file for ${NODE_ENV}`)
}

// keep a reference to the outermost context
// to avoid typeerrors when respawning the service
var OUTER = this

// we can only initialiase the DID service
// once everyone's accounted for
var worker_count = os.cpus().length, worker_ready = 0

var services = {}

function cluster_send(msg) {
  Object.keys(
    services.lifekey.cluster.workers
  ).forEach(function(id) {
    services.lifekey.cluster.workers[id].send(msg)
  })
}

function init_service(name, onmessage, then) {
  services[name] = cp.fork(
    `./src/init/${name}.js`
  ).on('error', function(err) {
    console.log(`${name} service error`, err)
  }).on('close', function(code, signal) {
    console.log(`${name} service exit`, code, signal)
    var msg = {}
    msg[`${name}_service_ready`] = false
    cluster_send(msg)
    init_service.apply(OUTER, arguments)
  }).on('message', function(msg) {
    if (msg.ready) {
      msg = {}
      msg[`${name}_service_ready`] = true
      cluster_send(msg)
    } else {
      // nothin' doing...
    }
  })
  if (onmessage) services[name].on('message', onmessage)
  if (typeof then === 'function') then()
}

services.lifekey = cluster({
  workers: {
    exec: 'src/init/worker.js',
    respawn: true,
    on: {
      error: function(err) {
        console.log(`SLAVE#${this.id} error`, err)
      },
      message: function(msg) {
        // TODO it would be nice to allow the services (http workers included) to boot in any order
        if (msg.ready) {
          worker_ready += 1
          if (worker_ready === worker_count) {
            init_service.call(OUTER, 'did', function(msg) {
              if (msg.push_notification_request ||
                  msg.webhook_notification_request) {
                services.notifier_service.send(msg)
              }
            })
            init_service.call(OUTER, 'notifier', function(msg) {})
          }
        } else if (msg.did_allocation_request) {
          // proxy the message to the DID service
          services.did.send(msg)
        } else if (msg.push_notification_request ||
                   msg.webhook_notification_request) {
          // proxy the message to the notifier service
          notifier_service.send(msg)
        } else {
          // nothing doing, otherwise
        }
      }
    }
  }
})
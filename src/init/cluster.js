
'use strict'

var fs = require('fs')
var os = require('os')
var cp = require('child_process')

var cluster = require('fluster')

var env = require('./env')()

// keep a reference to the outermost context
// to avoid typeerrors when respawning the service
var OUTER = this

var worker_shutdown_ready = 0

process.on('SIGUSR2', function() {
  cluster_send({shutdown: true})
})

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

function service_init(name, onmessage, then) {
  services[name] = cp.fork(
    `./src/init/${name}.js`
  ).on('error', function(err) {
    console.log(`${name} service error`, err)
  }).on('close', function(code, signal) {
    console.log(`${name} service exit`, code, signal)
    var msg = {}
    msg[`${name}_service_ready`] = false
    cluster_send(msg)
    service_init.apply(OUTER, [name, onmessage, then])
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
        if (msg.shutdown) {
          worker_shutdown_ready += 1
          if (worker_shutdown_ready === worker_count) {
            process.exit(0)
          }
        }
        if (msg.ready) {
          worker_ready += 1
          if (worker_ready === worker_count) {
            service_init.call(OUTER, 'did', function(msg) {
              if (msg.notification_request) {
                services.notifier.send(msg)
              }
            })
            service_init.call(OUTER, 'notifier', function(msg) {})
            service_init.call(OUTER, 'sendgrid', function(msg) {})
            service_init.call(OUTER, 'vc_generator', function(msg) {
              if (msg.notification_request) {
                services.notifier.send(msg)
              }
            })
          }
        }
        if (msg.did_allocation_request) {
          // proxy the message to the DID service
          services.did.send(msg)
        }
        if (msg.notification_request) {
          // proxy the message to the notifier service
          services.notifier.send(msg)
        }
        if (msg.send_email_request) {
          services.sendgrid.send(msg)
        }
        if (msg.vc_generation_request) {
          services.vc_generator.send(msg)
        }
      }
    }
  }
})
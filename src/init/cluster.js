
'use strict'

var fs = require('fs')
var os = require('os')
var cp = require('child_process')

var cluster = require('fluster')

var env = require('./env')()

var OUTER = this

process.on('SIGUSR2', function() {
  cluster_send({shutdown: true})
})

var worker_count = os.cpus().length, worker_shutdown_ready = 0

var services = {}

function cluster_send(msg) {
  Object.keys(
    http_cluster.cluster.workers
  ).forEach(function(id) {
    http_cluster.cluster.workers[id].send(msg)
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
    service_init.call(OUTER, name, onmessage, then)
  }).on('message', function(msg) {
    if (msg.ready) {
      msg = {}
      msg[`${name}_service_ready`] = true
      cluster_send(msg)
    }
  })
  if (onmessage) services[name].on('message', onmessage)
  if (typeof then === 'function') then()
}

function services_send(msg) {
  Object.keys(
    services
  ).forEach(function(name) {
    services[name].send(msg)
  })
}

service_init.call(OUTER, 'notifier', services_send)
service_init.call(OUTER, 'sendgrid', services_send)
service_init.call(OUTER, 'sms_otp', services_send)
service_init.call(OUTER, 'web_auth_signer', services_send)
service_init.call(OUTER, 'vc_generator', services_send)
service_init.call(OUTER, 'isa_ledger', services_send)
service_init.call(OUTER, 'did', services_send)

var http_cluster = cluster({
  workers: {
    exec: 'src/init/worker.js',
    respawn: true,
    on: {
      error: function(err) {
        console.log(`SLAVE#${this.id} error`, err)
      },
      message: function(msg) {
        // TODO remove message type checks and proxy all messages to all services (services are responsible for ignoring messages that are not addressed to them)
        // TODO measure message volume and ensure it will not bottleneck any services

        if (msg.shutdown) {
          worker_shutdown_ready += 1
          if (worker_shutdown_ready === worker_count) {
            process.exit(0)
          }
          return
        }

        services_send(msg)
      }
    }
  }
})

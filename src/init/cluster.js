
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

// service and cluster references
var did_service, lifekey

function cluster_send(msg) {
  Object.keys(
    lifekey.cluster.workers
  ).forEach(function(id) {
    lifekey.cluster.workers[id].send(msg)
  })
}

function init_did_service(then) {
  did_service = cp.fork(
    './src/init/did.js'
  ).on('error', function(err) {
    console.log('DID service error', err)
  }).on('close', function(code, signal) {
    console.log('DID service exit', code, signal)
    // notify all workers that did service is unavailable
    cluster_send({did_service_ready: false})
    // then attempt to restart the service
    init_did_service.call(OUTER)
  }).on('message', function(msg) {
    console.log('DID service message', msg)
    if (msg.ready) {
      // notify all workers that did service is available
      cluster_send({did_service_ready: true})
    }
  })
  if (typeof then === 'function') then()
}

lifekey = cluster({
  workers: {
    exec: 'src/init/worker.js',
    respawn: true,
    on: {
      error: function(err) {
        console.log(`SLAVE#${this.id} error`, err)
      },
      message: function(message) {
        console.log(`SLAVE#${this.id} message`, message)
        if (message.ready) {
          worker_ready += 1
          if (worker_ready === worker_count) {
            // once all http workers are ready,
            // initialise the did service worker and notify
            // all http workers
            init_did_service.call(OUTER)
          }
        } else if (message.did_allocation_request) {
          // proxy the message to the DID service
          did_service.send(message)
        } else {
          // nothing doing, otherwise
        }
      }
    }
  }
})

'use strict'

var fcm = require('../messaging/fcm')

console.log(typeof fcm, fcm.length)

process.on('message', function(msg) {
  if (msg.did_allocation_request) {
    // inspect the envelope
    // call a smart contract
    // reply to requesting client
    // via firebase push
  }
})

process.send({ready: true})

// simulate work for now...
setInterval(function() {
  process.send({now: Date.now()})
}, 1000 * 60)

setTimeout(function() {
  // intentionally uncaught referenceerror
  // to test the service availability code
  ajsdfjsaldfjsdlfj
}, 1000 * 60 * 5)
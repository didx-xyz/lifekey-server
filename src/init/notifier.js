
'use strict'

var fcm = require('../messaging/fcm')

process.on('message', function(msg) {
  if (msg.push_notification_request) {

    // send the message
    // fcm(blah, blah...)
  } else {
    // otherwise, nothing doing
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

'use strict'

var http = require('https')
var fcm = require('../messaging/fcm')

require('./database')(
  false // disable logging
).then(function(database) {

  var {db, models} = database

  process.on('message', function(msg) {
    if (msg.push_notification_request) {
      // fcm(...)
    } else if (msg.webhook_notification_request) {
      // http(...)
    } else {
      // otherwise, nothing doing
    }
  }).send({ready: true})

})

setInterval(function() {
  process.send({now: Date.now()})
}, 1000 * 60)
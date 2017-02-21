
'use strict'

var sendgrid = require('../messaging/sendgrid')

process.on('message', function(msg) {
  if (msg.send_email_request) {
    var {to, from, subject, content, mime} = msg.send_email_request
    sendgrid(to, from, subject, content, mime)
  }
}).send({ready: true})

'use strict'

var NODE_ENV = process.env.NODE_ENV || 'development'

try {
  var env = require(`../../etc/env/${NODE_ENV}.env.json`)
} catch (e) {
  // ENOENT
  throw new Error(`unable to find matching env file for ${NODE_ENV}`)
}

var compose = require('sendgrid').mail
var sendgrid = require('sendgrid')(env.SENDGRID_API_KEY)

module.exports = function(to, from, subject, content, mime) {
  return sendgrid.API(sendgrid.emptyRequest({
    method: 'POST',
    path: '/v3/mail/send',
    body: {
      personalizations: [{
        to: [{email: to}],
        subject: subject
      }],
      from: {email: 'no-reply@consent.global'},
      content: [{
        type: mime || 'text/plain',
        value: content
      }]
    }
  }), console.log)
}
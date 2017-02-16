
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

process.on('message', function(msg) {
  if (msg.send_email_request) {
    var {to, from, subject, content, mime} = msg.send_email_request
    sendgrid.API(sendgrid.emptyRequest({
      method: 'POST',
      path: '/v3/mail/send',
      body: (new compose.Mail(
        new compose.Email(to),
        subject,
        new compose.Email(from || 'no-reply@consent.global'),
        new compose.Content(mime || 'text/plain', content)
      )).toJSON()
    }), function(err, res) {
      if (err) console.log(err)
      else {
        console.log(res.statusCode)
        console.log(res.body)
        console.log(res.headers)
      }
    })
  }
}).send({ready: true})
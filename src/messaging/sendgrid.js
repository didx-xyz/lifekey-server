
'use strict'

var env = require('../init/lifeqienv')()

if (!env.SENDGRID_API_KEY) {
  console.log('SENDGRID_API_KEY missing, exiting...')
  process.exit(1)
}

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
  }), function(err, res) {
    if (err) return console.log(err)
    console.log('sent activation email to', to)
  })
}
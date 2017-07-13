
var cuid = require('cuid')

var env = require('./env')()
var sms = require('../messaging/clickatell')

var process_message_backlog = []
var sms_verification, user_datum, errors

function otp_message(otp) {
  return (
    'Please open the following URL to verify your mobile number with Lifekey: ' +
    `http://${env.SERVER_HOSTNAME}/sms-verify/${otp}`
  )
}

function process_message(msg) {
  if (!(sms_verification && user_datum && errors)) {
    process_message_backlog.push(msg)
  }

  if (!msg.sms_otp_request) return

  var {user_id, user_datum_id} = msg.sms_otp_request

  sms_verification.findOne({
    where: {
      owner_id: user_id,
      user_datum_id: user_datum_id
    }
  }).then(function(found) {
    if (found) {
      return Promise.reject(
        new Error(
          `sms otp already in-flight for user ${user_id} and datum ${user_datum_id}`
        )
      )
    }
    return user_datum.findOne({
      where: {id: user_datum_id}
    })
  }).then(function(found) {
    if (!found) {
      return Promise.reject(
        new Error(
          `user datum record ${user_datum_id} not found`
        )
      )
    }
    try {
      var resource = JSON.parse(found.value)
    } catch (e) {
      return Promise.reject(e)
    }
    return resource.mobile || resource.telephone || null
  }).then(function(recipient) {
    var otp = cuid()
    return Promise.all([
      sms_verification.create({
        owner_id: user_id,
        user_datum_id: user_datum_id,
        otp: otp
      }),
      sms(recipient, otp_message(otp))
    ])
  }).then(function(res) {
    var [created] = res
    console.log('otp sms in flight for user', user_id)
  }).catch(function(err) {
    console.log('sms_otp service error', err)
  })
}

process.on('message', process_message)

require('./database')(
  false
).then(function(database) {
  sms_verification = database.models.sms_verification
  user_datum = database.models.user_datum
  errors = database.errors
  while (process_message_backlog.length) {
    process_message(process_message_backlog.pop())
  }
  process.send({ready: true})
}).catch(function(err) {
  console.log('sms_otp ---', err || 'no error message')
  process.send({ready: false})
})

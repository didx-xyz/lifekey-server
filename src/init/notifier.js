
'use strict'

var url = require('url')

var fcm = require('../messaging/fcm')
var webhook = require('../messaging/webhook')

var failures = {
  fcm: [],
  webhook: [],
  retries: 9
}

var db, models

function dispatch(msg, user_id) {
  return new Promise(function(resolve, reject) {
    models.user.findOne({
      where: {id: user_id}
    }).then(function(found) {
      if (found) {
        if (found.webhook_url) {
          return Promise.resolve(found.webhook_url)
        }
        return models.user_device.findOne({
          where: {owner_id: user_id}
        })
      }
      return Promise.reject(
        new Error('couldnt find user by id ' + user_id)
      )
    }).then(function(value) {
      if (typeof value === 'string') {
        return resolve(
          webhook(
            url.parse(value),
            msg.data.type,
            msg.notification,
            msg.data,
            function() {
              console.log('WEBHOOK RETRY', value)
              failures.webhook.push({
                uri: value,
                user_id: user_id,
                msg: msg,
                ttl: failures.retries
              })
            }
          )
        )
      }
      resolve(
        fcm(
          value.device_id,
          {notification: msg.notification, data: msg.data}
        )
      )
    }).catch(reject)
  })
}

require('./database')(
  false // disable logging
).then(function(database) {

  db = database.db
  models = database.models

  process.on('message', function(msg) {
    if (!msg.notification_request) {
      return console.log(
        'ERROR',
        'received a message with an unknown type',
        Object.keys(msg)
      )
    }
    var {user_id} = msg.notification_request
    var user_ids = (Array.isArray(user_id) ? user_id : [user_id])
    Promise.all(
      user_ids.map(
        dispatch.bind(
          dispatch,
          msg.notification_request
        )
      )
    ).catch(console.log)
  }).send({ready: true})
})

var retryTimer = setInterval(function() {
  // TODO fcm retries
  
  Promise.all(
    failures.webhook.map(function(hook) {
      return webhook(
        url.parse(hook.uri),
        hook.msg.data.type,
        hook.msg.notification,
        hook.msg.data
      )
    })
  ).then(function(res) {
    for (var i = res.length - 1; i >= 0; i--) {
      if (res[i]) {
        failures.webhook.splice(i, 1)
        continue
      }
      if (failures.webhook[i]) {
        if (failures.webhook[i].ttl === 0) {
          var dropped = failures.webhook.splice(i, 1).pop()
          models.dropped_message.create({
            owner_id: dropped.user_id,
            dropped_at: new Date,
            contents: JSON.stringify(dropped.msg)
          }).catch(
            console.log.bind(
              console,
              'ERROR SAVING DROPPED MESSAGE'
            )
          )
        } else {
          failures.webhook[i].ttl -= 1
        }
      } else {
        // this branch will execute if we
        // clobber the array into being sparse
        console.log('this should never happen :3')
      }
    }
  }).catch(console.log)
}, 20 * 1000)
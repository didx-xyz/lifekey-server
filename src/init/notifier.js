
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

require('./database')(
  false // disable logging
).then(function(database) {

  db = database.db
  models = database.models

  process.on('message', function(msg) {

    if (msg.notification_request) {
      var {user_id, notification, data} = msg.notification_request
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
          return webhook(
            url.parse(value),
            data.type,
            notification,
            data,
            function() {
              console.log('notifier retry', value)
              failures.webhook.push({
                uri: value,
                user_id: user_id,
                msg: msg.notification_request,
                ttl: failures.retries
              })
            }
          )
        } else {
          return fcm(
            value.device_id,
            notification,
            data,
            console.log
          )
        }
      }).catch(console.log)
    }
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
          var dropped = failures.webhook.splice(i, 1)
          console.log('about to save droped message', dropped)
          models.dropped_message.create({
            owner_id: dropped.user_id,
            dropped_at: new Date,
            contents: JSON.stringify(dropped.msg || '{}')
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
        console.log('this should never happen :3')
      }
    }
  }).catch(console.log)
}, 2 * 1000)
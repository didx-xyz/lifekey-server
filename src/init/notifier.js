
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
    if (!msg.notification_request) {
      return console.log(
        'ERROR',
        'received a message with an unknown type',
        Object.keys(msg)
      )
    }
    var {user_id, notification, data} = msg.notification_request
    models.user.findOne({
      where: (
        (user_id === 'example') ||
        typeof user_id === 'string' &&
        user_id.length === 64 ?
        {did: user_id} :
        {id: user_id}
      )
    }).then(function(found) {
      if (found) {
        if (found.webhook_url) return Promise.all([null, found])
        return Promise.all([
          models.user_device.findOne({where: {owner_id: found.id}}),
          null
        ])
      }
      return Promise.reject(
        new Error('couldnt find user by id ' + user_id)
      )
    }).then(function(value) {
      if (!value[0]) {
        return webhook(
          url.parse(value[1].webhook_url),
          data.type,
          notification,
          data,
          function() {
            console.log('WEBHOOK RETRY', value[1].webhook_url)
            failures.webhook.push({
              uri: value[1].webhook_url,
              user_id: value[1].id,
              msg: msg.notification_request,
              ttl: failures.retries
            })
          }
        )
      }
      return fcm(
        value[0].device_id,
        notification,
        data,
        console.log
      )
    }).catch(console.log)
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

'use strict'

var url = require('url')

var fcm = require('../messaging/fcm')
var webhook = require('../messaging/webhook')

var MAX_RETRIES = 9

var failures = {
  fcm: [],
  webhook: []
}

function retryonsent(arr, idx, err) {
  var retry = failures[arr][idx]
  if (err) {
    failures[arr][idx].ttl -= 1
  } else {
    failures[arr].splice(idx, 1)
    console.log('reached', retry.uri, 'after', (MAX_RETRIES - retry.ttl), 'attempts')
  }
}

require('./database')(
  false // disable logging
).then(function(database) {

  var {db, models} = database

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
            function(err) {
              if (err) {
                console.log('notifier service retry for', value)
                failures.webhook.push({
                  uri: value,
                  msg: msg.notification_request,
                  ttl: MAX_RETRIES
                })
              }
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
  
  for (var i = failures.webhook.length - 1; i >= 0; i--) {
    var icur = failures.webhook[i]
    if (icur.ttl === 0) failures.webhook.splice(i, 1)
    webhook(
      url.parse(icur.uri),
      icur.msg.data.type,
      icur.msg.notification,
      icur.msg.data,
      retryonsent.bind({arr: 'webhook', idx: i})
    )
  }
}, 20 * 1000)

'use strict'

var url = require('url')

var fcm = require('../messaging/fcm')
var webhook = require('../messaging/webhook')

var failures = {
  fcm: [],
  webhook: []
}

function retryonsent(err) {
  var retry = failures[this.arr][this.idx]
  if (err) {
    retry.ttl -= 1
  } else {
    failures[this.arr].splice(this.idx, 1)
  }
}

require('./database')(
  false // disable logging
).then(function(database) {

  var {db, models} = database

  process.on('message', function(msg) {

    if (msg.push_notification_request) {
      console.log('new push request', msg.push_notification_request)
      var {user_id, device_id, notification, data} = msg.push_notification_request
      // FIXME wire up to retries (has prerequisite FIXME in messaging/fcm)

      if (user_id && !device_id) {
        models.user_device.findOne({
          where: {owner_id: user_id}
        }).then(function(found) {
          if (found) {
            return fcm(
              device_id,
              notification,
              data,
              console.log
            )
          }
          // USER DEVICE NOT FOUND
        })
      } else {
        fcm(
          device_id,
          notification,
          data,
          console.log
        )
      }
    } else if (msg.webhook_notification_request) {
      
      var {user_id, webhook_url, notification, data} = msg.webhook_notification_request
      var msg = {notification: notification, data: data}

      var get_user_hook_addr = (function() {
        if (webhook_url) return Promise.resolve(url.parse(webhook_url))
        return database.models.user.findOne({
          where: {id: user_id}
        }).then(function(found) {
          if (found && found.webhook_url) {
            return Promise.resolve(
              url.parse(found.webhook_url)
            )
          } else if (found && !found.webhook_url) {
            return Promise.reject(
              {webhook_err: 'user is not enrolled for webhook notifications'}
            )
          } else {
            return Promise.reject(
              {webhook_err: 'user record not found'}
            )
          }
        })
      })()

      get_user_hook_addr.then(function(addr) {
        webhook(addr, msg, function(err) {
          if (err) {
            failures.webhook.push({
              uri: addr,
              msg: msg,
              ttl: 9
            })
          }
        })
      }).catch(function(err) {
        // fatal error, cannot retry
        // (could happen if user no longer exists)
        console.log(err)
      })

    } else {
      // otherwise, nothing doing
    }
  }).send({ready: true})

})

var retryTimer = setInterval(function() {
  // TODO fcm retries
  
  for (var i = failures.webhook.length - 1; i >= 0; i--) {
    var icur = failures.webhook[i]
    if (icur.ttl === 0) failures.webhook.splice(i, 1)
    webhook(icur.uri, icur.msg, retryonsent.bind({arr: 'webhook', idx: i}))
  }
}, 20 * 1000)
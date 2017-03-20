
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
                failures.webhook.push({
                  uri: addr,
                  msg: msg,
                  ttl: 9
                })
              }
            }
          )
        } else {
          return fcm(
            value,
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
    webhook(icur.uri, icur.msg, retryonsent.bind({arr: 'webhook', idx: i}))
  }
}, 20 * 1000)
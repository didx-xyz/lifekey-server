
'use strict'

var http = require('https')

var NODE_ENV = process.env.NODE_ENV || 'development'
var env

try {
  env = require(`../../etc/env/${NODE_ENV}.env.json`)
} catch (e) {
  // ENOENT
  throw new Error(`unable to find matching env file for ${NODE_ENV}`)
}

function message(recipient, notification, data) {
  // TODO expand with more options (platforms, design, topics)

  // guard message construction according to fcm messaging conventions
  // notification and data are optional
  if (!recipient) {
    throw new Error(`expected truthy value, got: ${recipient}`)
  }
  
  var msg = {}
  
  if (Array.isArray(recipient)) {
    // multiple recipients
    msg.registration_ids = recipient
  } else {
    // single recipient
    msg.to = recipient
  }
  
  if (data) msg.data = data
  if (notification) msg.notification = notification
  
  return msg
}

module.exports = function(recipient, notification, data, sent) {
  // serialise the given message parameters
  try {
    var envelope = message(recipient, notification, data)
  } catch (e) {
    return sent(e)
  }
  // construct the fcm request
  var request = http.request({
    method: 'POST',
    host: env.FCM_ENDPOINT_HOST,
    path: env.FCM_ENDPOINT_PATH,
    port: env.FCM_ENDPOINT_PORT,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `key=${env.FCM_SERVER_KEY}`
    }
  })

  // attach listeners
  request.on('response', function(res) {
    if (res.statusCode !== 200) {
      return sent(new Error(res.statusCode))
    }
    
    var response = ''
    res.on('data', function(d) {
      response += d
    }).on('end', function() {
      try {
        response = JSON.parse(response)
      } catch (e) {
        return sent(e)
      }
      
      if (response.failure === 0 || response.canonical_ids === 0) {
        // success, message sent
        return sent(null, response)
      }
      
      // FIXME see below
      // otherwise, inspect message further
      // if `message_id` is set, check for `registration_id`:
        // if `registration_id` is set, replace the original ID with the new value (canonical ID) in your server database
        // note that the original ID is not part of the result
        // so you need to obtain it from the list of `registration_id`s passed in the request
      
      // otherwise, get the value of `error`:
        // If it is `Unavailable`, you could retry to send it in another request.
        // If it is `NotRegistered`, you should remove the `registration ID` from your server database because the application was uninstalled from the device, or the client app isn't configured to receive messages.
        // Otherwise, there is something wrong in the registration token passed in the request; it is probably a non-recoverable error that will also require removing the registration from the server database.
    })
  }).on('error', sent)

  // and send
  request.end(JSON.stringify(envelope))
}
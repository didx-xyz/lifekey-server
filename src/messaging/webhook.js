
'use strict'

var http = require('https')

var env = require('../init/env')()

module.exports = (
  !~env._.indexOf('istanbul') ?
  (uri, type, notification, data, onfailure) => Promise.resolve(true) :
  function(uri, type, notification, data, onfailure) {
    return new Promise(function(resolve, reject) {
      var request = http.request({
        method: 'post',
        hostname: uri.hostname,
        path: uri.path,
        port: uri.port,
        headers: {'content-type': 'application/json'}
      })
      
      var deadlineTimer = setTimeout(request.abort, 5000)
      
      request.on('response', function(r) {
        clearTimeout(deadlineTimer)
        if (r.statusCode === 200) {
          console.log('got 200 response code from', uri.hostname)
          resolve(true)
        } else {
          console.log('got', r.statusCode, 'failure from', uri.hostname)
          if (typeof onfailure === 'function') onfailure()
          resolve()
        }
      }).on('abort', function() {
        if (typeof onfailure === 'function') onfailure()
        console.log('aborted webhook to', uri.hostname)
        resolve()
      }).on('error', function(err) {
        clearTimeout(deadlineTimer)
        console.log('error reaching', uri.hostname, err)
        if (typeof onfailure === 'function') onfailure()
        resolve()
      }).end(
        JSON.stringify({
          type: type,
          notification: notification,
          data: data
        })
      )
    })
  }
)
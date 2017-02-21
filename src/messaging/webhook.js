
'use strict'

var http = require('https')

module.exports = function(uri, msg, onsent) {
  http.request({
    host: uri.host,
    path: uri.path,
    headers: {'content-type': 'application/json'}
  }).on('response', function(r) {
    return onsent(r.statusCode !== 200)
  }).on('error', onsent).end(JSON.stringify(msg))
}
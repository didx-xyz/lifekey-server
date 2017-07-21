
var url = require('url')
var qs = require('querystring')
var https = require('https')

var env = require('../init/env')()

// HTTP/S://platform.clickatell.com/messages/http/send?apiKey=xxxxxxxxxxxxxxxx==&to=xxxxxxxxxxx&content=Test+message+text

var gateway = 'https://platform.clickatell.com/messages/http/send'

var send = url.parse(gateway)

module.exports = function(to, content, sent) {
  var has_callback = typeof sent === 'function'

  if (!(to &&
        typeof to === 'string' &&
        to.length === 10 &&
        content &&
        typeof content === 'string' &&
        content.length <= 160)
  ) {
    var args_error = new Error('missing required arguments')
    if (has_callback) return sent(args_error)
    throw args_error
  }

  // FIXME i18n
  var recipient = `27${to.slice(1)}`
  var message = content.split(' ').join('+')
  var query = qs.stringify({
    to: recipient,
    content: message,
    apiKey: env.CLICKATELL_API_KEY
  })

  https.request({
    protocol: send.protocol,
    hostname: send.hostname,
    port: send.port,
    path: `${send.pathname}?${query}`,
    method: 'get'
  }).on('response', function(res) {
    if (res.statusCode > 99 && res.statusCode < 400) {
      console.log('message accepted by clickatell gateway with', res.statusCode)
      if (has_callback) return sent()
      return
    }

    var r = ''
    res.on('data', function(data) {
      r += data
    }).on('end', function() {
      if (has_callback) {
        return sent(
          new Error(
            `clickatell gateway error ${res.statusCode}\n${r}`
          )
        )
      }
      console.log(
        'clickatell gateway error',
        res.statusCode,
        r
      )
    })
  }).on('error', function(err) {
    if (has_callback) return sent(err)
  }).end()
}

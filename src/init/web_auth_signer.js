
'use strict'

var url = require('url')
var http = require('http')
var https = require('https')

var crypto = require('../crypto')

var crypto_key, user, errors
var process_message_backlog = []

function process_message(msg) {

  if (!msg.web_auth_request) return
  if (!(crypto_key && user && errors)) {
    process_message_backlog.push(msg)
    return
  }

  var return_addr, {user_id, challenge, did} = msg.web_auth_request

  user.findOne({
    where: {did: did}
  }).then(function(found) {
    if (!found) {
      
      process.send({
        notification_request: {
          user_id: user_id,
          notification: {title: '', body: ''},
          data: {
            type: 'webauth_failure',
            webauth_failure_type: 'user_not_found'
          }
        }
      })

      return Promise.reject(
        new Error('user not found')
      )
    }
    if (!found.web_auth_url) {
      
      process.send({
        notification_request: {
          user_id: user_id,
          notification: {title: '', body: ''},
          data: {
            type: 'webauth_failure',
            webauth_failure_type: 'user_has_no_webauth_address'
          }
        }
      })

      return Promise.reject(
        new Error('user has no web_auth hook address')
      )
    }
    return_addr = url.parse(found.web_auth_url)
    return crypto_key.findOne({
      where: {
        owner_id: found.id,
        alias: 'eis'
      }
    })
  }).then(function(found) {
    if (!found) {

      process.send({
        notification_request: {
          user_id: user_id,
          notification: {title: '', body: ''},
          data: {
            type: 'webauth_failure',
            webauth_failure_type: 'user_has_no_crypto_key'
          }
        }
      })

      return Promise.reject(new Error('user has no eis key'))
    }
    return Promise.all([
      challenge,
      crypto.asymmetric.sign('secp256k1', found.private_key, Buffer.from(challenge, 'utf8')),
      crypto.asymmetric.get_public('secp256k1', found.private_key)
    ])
  }).then(function(res) {
    var [plaintext, signature, public_key] = res
    var msg = JSON.stringify({
      challenge: challenge,
      plaintext: plaintext,
      signature: signature.toString('base64'),
      public_key: public_key.toString('base64')
    })
    return Promise.resolve(Buffer.from(msg, 'utf8'))
  }).then(function(msg) {
    return new Promise(function(resolve, reject) {
      (
        return_addr.protocol === 'http:' ? http : https
      ).request({
        method: 'post',
        protocol: return_addr.protocol,
        hostname: return_addr.hostname,
        path: return_addr.path,
        port: return_addr.port,
        headers: {
          'content-type': 'application/json',
          'content-length': Buffer.byteLength(msg)
        }
      }).on('response', function(res) {
        if (res.statusCode !== 200) {


          process.send({
            notification_request: {
              user_id: user_id,
              notification: {title: '', body: ''},
              data: {
                type: 'webauth_failure',
                webauth_failure_type: 'remote_service_denied_access'
              }
            }
          })

          return reject(new Error('remote service denied access'))
        }
        return resolve()
      }).on('error', function(err) {


        // TODO retry?
        
        process.send({
          notification_request: {
            user_id: user_id,
            notification: {title: '', body: ''},
            data: {
              type: 'webauth_failure',
              webauth_failure_type: 'server_network_transport_error'
            }
          }
        })

        return reject(new Error('network transport error'))
      }).end(msg)
    })
  }).then(function() {
    console.log('auth hook sent successfully to', return_addr.hostname)
  }).catch(function(err) {
    console.log(errors(err))
  })
}

process.on('message', process_message)

require('./database')(
  false
).then(function(database) {
  user = database.models.user
  crypto_key = database.models.crypto_key
  errors = database.errors
  while (process_message_backlog.length) {
    process_message(process_message_backlog.pop())
  }
  process.send({ready: true})
}).catch(function(err) {
  console.log('web_auth_signer ---', err || 'no error message')
  process.send({ready: false})
})
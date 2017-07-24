
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

  var {user_id, challenge, did} = msg.web_auth_request

  Promise.all([
    user.findOne({where: {did: did}}),
    crypto_key.findOne({where: {owner_id: user_id, alias: 'eis'}}),
    user.findOne({where: {id: user_id}})
  ]).then(function(res) {
    var [authentication_service, authenticating_user_key, authenticating_user] = res
    if (!authentication_service) {
      return Promise.reject('user_not_found')
    }
    if (!authentication_service.web_auth_url) {
      return Promise.reject('user_has_no_webauth_address')
    }
    if (!authenticating_user_key) {
      return Promise.reject('user_has_no_crypto_key')
    }
    if (!authenticating_user) {
      return Promise.reject('user_not_found')
    }
    return Promise.all([
      authentication_service.web_auth_url,
      authenticating_user.did,
      challenge,
      crypto.asymmetric.sign('secp256k1', authenticating_user_key.private_key, Buffer.from(challenge, 'utf8')),
      crypto.asymmetric.get_public('secp256k1', authenticating_user_key.private_key)
    ])
  }).then(function(res) {
    var [return_address, user_did, plaintext, signature, public_key] = res
    var msg = JSON.stringify({
      challenge: challenge,
      plaintext: plaintext,
      signed_challenge: signature.toString('base64'),
      did: user_did,
      public_key: public_key.toString('base64')
    })
    return Promise.all([return_address, Buffer.from(msg, 'utf8')])
  }).then(function(res) {
    var [return_address, msg] = res
    return new Promise(function(resolve, reject) {
      (
        return_address.protocol === 'http:' ? http : https
      ).request({
        method: 'post',
        protocol: return_address.protocol,
        hostname: return_address.hostname,
        path: return_address.path,
        port: return_address.port,
        headers: {
          'content-type': 'application/json',
          'content-length': Buffer.byteLength(msg)
        }
      }).on('error', function(err) {
        return reject('server_network_transport_error')
      }).on('response', resolve).end(msg)
    })
  }).then(function() {
    console.log('auth service successfully hooked for', user_id)
  }).catch(function(err) {
    process.send({
      notification_request: {
        user_id: user_id,
        notification: {title: '', body: ''},
        data: {
          type: 'webauth_failure',
          webauth_failure_type: err
        }
      }
    })
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
    setImmediate(process_message, process_message_backlog.pop())
  }
  process.send({ready: true})
}).catch(function(err) {
  console.log('web_auth_signer ---', err || 'no error message')
  process.send({ready: false})
})

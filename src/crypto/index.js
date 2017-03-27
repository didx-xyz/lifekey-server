
'use strict'

var crypto = require('crypto')

var rsa = require('ursa')
var secp = require('eccrypto')

var buffer_error_message = 'base64 parsing or shasum error in any of: public_key, plaintext_proof signed_proof'

function buffers_for_verify(algorithm, public_key, plaintext, signature) {
  var b_public_key = Buffer.from(public_key, algorithm === 'rsa' ? 'utf8' : 'base64')
  var b_signable = crypto.createHash('sha256').update(plaintext).digest()
  var b_signed = Buffer.from(signature, 'base64')
  if (!(b_public_key.length && b_signable.length && b_signed.length)) return null
  return [b_public_key, b_signable, b_signed]
}

module.exports = {
  asymmetric: {
    is_supported_algorithm: function(algorithm) {
      return !!~[
        'rsa',
        'secp256k1'
      ].indexOf(
        algorithm.toLowerCase()
      )
    },
    get_buffers: function(algorithm, public_key, plaintext, signature) {
      try {
        var buffers = buffers_for_verify(algorithm, public_key, plaintext, signature)
      } catch (e) {
        return Promise.reject({
          error: true,
          status: 400,
          message: buffer_error_message,
          body: null
        })
      }
      if (!buffers) {
        return Promise.reject({
          error: true,
          status: 400,
          message: buffer_error_message,
          body: null
        })
      }
      return Promise.resolve(buffers)
    },
    // TODO sign: function() {},
    verify: function(algorithm, public_key, plaintext, signature) {
      var [b_public_key, b_signable, b_signature] = buffers_for_verify(algorithm, public_key, plaintext, signature)
      if (!b_public_key) {
        return Promise.reject({
          error: true,
          status: 400,
          message: buffer_error_message,
          body: null
        })
      }

      if (algorithm === 'secp256k1') {
        return secp.verify(
          b_public_key,
          b_signable,
          b_signature
        ).catch(function(err) {
          if (err.toString() === 'Error: couldn\'t parse DER signature') {
            // console.log('hit')
            return Promise.reject({
              error: true,
              status: 400,
              message: 'non-signature value given',
              body: null
            })
          }
        })
      }

      if (algorithm === 'rsa') {
        try {
          var rsa_public_key = rsa.coercePublicKey(public_key)
          return (
            rsa_public_key.hashAndVerify(
              'sha256',
              Buffer(plaintext),
              signature,
              'base64',
              false
            )
          ) ? Promise.resolve() : (
            Promise.reject({
              error: true,
              status: 400,
              message: 'signature verification failed',
              body: null
            })
          )
        } catch (e) {
          return Promise.reject({
            error: true,
            status: 400,
            message: e.toString(),
            body: null
          })
        }
      }
    }
  }
}
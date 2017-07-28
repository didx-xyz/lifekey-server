
'use strict'

var crypto = require('crypto')

var secp = require('eccrypto')

var our_crypto = require('lifekey-crypto')

var buffer_error_message = 'base64 parsing or shasum error in any of: public_key, plaintext_proof signed_proof'

function buffers_for_verify(algorithm, public_key, plaintext, signature) {
  var b_public_key = Buffer.from(public_key, algorithm === 'rsa' ? 'utf8' : 'base64')
  var b_signable = crypto.createHash('sha256').update(plaintext).digest()
  var b_signed = Buffer.from(signature, 'base64')
  return (
    b_public_key.length &&
    b_signable.length &&
    b_signed.length
  ) ? [
    b_public_key,
    b_signable,
    b_signed
  ] : null
}

module.exports = {
  asymmetric: {
    is_supported_algorithm: our_crypto.asymmetric.is_supported_algorithm,
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
    sign: function(algorithm, private_key, plaintext) {
      if (algorithm === 'secp256k1') {
        return our_crypto.asymmetric.secp256k1.sign(
          private_key, plaintext
        )
      }
      if (algorithm === 'rsa') {
        return new Promise(function(resolve, reject) {
          our_crypto.asymmetric.rsa.sign(
            private_key, plaintext
          ).then(resolve).catch(function(err) {
            reject({
              error: true,
              status: 400,
              message: err.toString(),
              body: null
            })
          })
        })
      }
      throw new Error('unsupported algorithm')
    },
    verify: function(algorithm, public_key, plaintext, signature) {
      var [
        b_public_key,
        b_signable,
        b_signature
      ] = buffers_for_verify(algorithm, public_key, plaintext, signature)
      if (!b_public_key) {
        return Promise.reject({
          error: true,
          status: 400,
          message: buffer_error_message,
          body: null
        })
      }

      if (algorithm === 'secp256k1') {
        return new Promise(function(resolve, reject) {
          our_crypto.asymmetric.secp256k1.verify(
            b_public_key, plaintext, b_signature
          ).then(resolve).catch(function(err) {
            reject({
              error: true,
              status: 400,
              message: err,
              body: null
            })
          })
        })
      }

      if (algorithm === 'rsa') {
        return new Promise(function(resolve, reject) {
          our_crypto.asymmetric.rsa.verify(
            b_public_key, plaintext, b_signature
          ).then(function(verified) {
            if (verified) return resolve()
            return reject({
              error: true,
              status: 400,
              message: 'signature verification failed',
              body: null
            })
          }).catch(function(err) {
            return reject({
              error: true,
              status: 400,
              message: err,
              body: null
            })
          })
        })

        // try {
        //   var verifier = crypto.createVerify('RSA-SHA256')
        //   verifier.update(plaintext)
        //   var verified = verifier.verify(b_public_key, b_signature)
        // } catch (e) {
        //   return Promise.reject({
        //     error: true,
        //     status: 400,
        //     message: e.toString(),
        //     body: null
        //   })
        // }

        // if (verified) return Promise.resolve()

        // return Promise.reject({
        //   error: true,
        //   status: 400,
        //   message: 'signature verification failed',
        //   body: null
        // })
      }

      throw new Error('unsupported algorithm')
    },
    get_public: function(algorithm, private_key) {
      if (algorithm === 'secp256k1') return secp.getPublic(private_key)
      if (algorithm === 'rsa') return our_crypto.asymmetric.rsa.get_public(private_key)
      throw new Error('unsupported algorithm')
    }
  }
}

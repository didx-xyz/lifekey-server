
'use strict'

var verifySignature = (
  !!~process.env._.indexOf('istanbul') ?
  ((req, res, next) => next()) :
  require('./verify-signature')
)

module.exports = function(req, res, next) {

  var OUTER = this

  // load models for querying and insertion
  var {http_request_verification} = this.get('models')

  var public_key = (
    req.user.crypto.algorithm === 'rsa' ?
    req.user.crypto.public_key.toString('utf8') : // rsa keys are pem format
    req.user.crypto.public_key.toString('base64') // p256k1 keys are not pem format
  )

  http_request_verification.findOne({
    where: {
      algorithm: req.user.crypto.algorithm,
      signature: req.headers['x-cnsnt-signed']
    }
  }).then(function(found) {
    if (found) {
      return Promise.reject({
        error: true,
        status: 400,
        message: 'detected a known signature',
        body: null
      })
    }
    // create the record for posterity
    return http_request_verification.create({
      public_key: public_key,
      algorithm: req.user.crypto.algorithm,
      plaintext: req.headers['x-cnsnt-plain'],
      signature: req.headers['x-cnsnt-signed']
    })
  }).then(function(created) {
    // we're done here!
    if (created) return verifySignature.call(OUTER, req, res, next)
    return Promise.reject({
      error: true,
      status: 500,
      message: 'unable to create http_request_verification record',
      body: null
    })
  }).catch(function(err) {
    return res.status(
      err.status || 500
    ).json({
      error: err.error || true,
      status: err.status || 500,
      message: err.message || 'internal server error',
      body: err.body || null
    })
  })
}
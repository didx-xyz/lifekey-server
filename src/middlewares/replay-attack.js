
'use strict'

module.exports = function(req, res, next) {

  // if the current route and method are not a secured route, skip the middleware
  if (req.skip_secure_checks) return next()

  // load models for querying and insertion
  var {
    user,
    crypto_key,
    http_request_verification
  } = this.get('models')

  var user_public_key
  
  // find their http signing key
  return crypto_key.findOne({
    where: {
      owner_id: req.user.id,
      alias: 'client-server-http'
    }
  }).then(function(found) {
    if (found) {
      // attach the key for subsequent middleware
      req.user.crypto = found
      user_public_key = found.public_key.toString('hex')
      // ensure previous requests on record
      // have not used the provided authentication data
      return http_request_verification.findOne({
        where: {
          public_key: user_public_key,
          signable: req.headers['x-cnsnt-signable'],
          signature: req.headers['x-cnsnt-signed']
        }
      })
    }
    return Promise.reject({
      error: true,
      status: 404,
      message: 'crypto key not found',
      body: null
    })
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
      public_key: user_public_key,
      algorithm: req.user.crypto.algorithm,
      signable: req.headers['x-cnsnt-signable'],
      signed: req.headers['x-cnsnt-signed']
    })
  }).then(function(created) {
    if (created) return next() // we're done here!
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
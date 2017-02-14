
'use strict'

module.exports = function(req, res, next) {

  // if the current route and method are not a secured route, skip the middleware
  if (req.skip_secure_checks) return next()

  // load models for querying and insertion
  var {http_request_verification} = this.get('models')

  var hex_public_key = req.user.crypto.public_key.toString('hex')

  http_request_verification.findOne({
    where: {
      public_key: hex_public_key,
      algorithm: req.user.crypto.algorithm,
      signable: req.headers['x-cnsnt-signable'],
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
      public_key: hex_public_key,
      algorithm: req.user.crypto.algorithm,
      signable: req.headers['x-cnsnt-signable'],
      signature: req.headers['x-cnsnt-signed']
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
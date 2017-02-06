
'use strict'

module.exports = function(req, res, next) {

  // if the current route and method are not a secured route, skip the middleware
  if (!this.get(`secure_${req.method.toLowerCase()}_${req.route.path}`)) return next()

  // load models for querying and insertion
  var {
    user,
    crypto_key,
    http_request_verification
  } = this.get('models')

  var user_public_key
  
  // find the record for the calling agent
  user.findOne({
    where: {
      $or: [
        {did: req.headers['x-cnsnt-did']},
        {id: req.headers['x-cnsnt-id']}
      ]
    }
  }).then(function(found) {
    if (!found) {
      return Promise.reject({
        error: true,
        status: 404,
        message: 'user not found',
        body: null
      })
    }

    // attach user record for subsequent middleware and routes
    req.user = found

    // find their http signing key
    return crypto_key.findOne({
      where: {
        owner_id: found.id,
        alias: 'client-server-http'
      }
    })
  }).then(function(found) {
    if (!found) {
      return Promise.rejcect({
        error: true,
        status: 404,
        message: 'crypto key not found',
        body: null
      })
    }
    
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
  }).then(function(found) {
    if (found) {
      return Promise.reject({
        error: true,
        status: 401,
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
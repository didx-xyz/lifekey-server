
'use strict'

var assertAppActivated = (
  !!~process.env._.indexOf('istanbul') ?
  ((req, res, next) => next()) :
  require('./assert-app-activated')
)

module.exports = function(req, res, next) {
  var OUTER = this

  if (!((req.headers['x-cnsnt-did'] || req.headers['x-cnsnt-id']) &&
        ('x-cnsnt-plain' in req.headers &&
        'x-cnsnt-signed' in req.headers))) {
    // if missing any of the above
    return res.status(400).json({
      error: true,
      status: 400,
      message: 'authentication parameters missing from request headers',
      body: null
    })
  }
  
  var {user, crypto_key} = this.get('models')
  
  user.findOne({
    where: {
      $or: [
        {id: req.headers['x-cnsnt-id']},
        {did: req.headers['x-cnsnt-did']}
      ]
    }
  }).then(function(found) {
    if (found) {
      req.user = found
      return crypto_key.findOne({
        where: {
          owner_id: found.id,
          alias: 'client-server-http'
        }
      })
    }
    return Promise.reject({
      error: true,
      status: 404,
      message: 'user record not found',
      body: null
    })
  }).then(function(found) {
    if (req.headers['x-cnsnt-did'] === 'example') {
      return next()
    }
    if (found) {
      req.user.crypto = found
      return assertAppActivated.call(OUTER, req, res, next)
    }
    return Promise.reject({
      error: true,
      status: 404,
      message: 'crypto_key record not found',
      body: null
    })
  }).catch(function(err) {
    return res.status(
      err.status || 500
    ).json({
      error: true,
      status: err.status || 500,
      message: err.message || 'internal server error',
      body: err.body || null
    })
  })
}
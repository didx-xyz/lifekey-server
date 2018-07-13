
'use strict'

var assertAppActivated = ((process.env._ &&
  !!~process.env._.indexOf('istanbul')) ?
  ((req, res, next) => next()) :
  require('./assert-app-activated')
)

module.exports = function(req, res, next) {
  var OUTER = this

  // the calling agent's identity
  var has_did_or_id = (
    'x-cnsnt-did' in req.headers ||
    'x-cnsnt-id' in req.headers
  )

  // the calling agent's identity proof
  var has_plaintext_and_signature = (
    'x-cnsnt-plain' in req.headers &&
    'x-cnsnt-signed' in req.headers
  )

  if (!(has_did_or_id && has_plaintext_and_signature)) {
    return res.status(400).json({
      error: true,
      status: 400,
      message: 'authentication parameters missing from request headers',
      body: null
    })
  }

  var errors = this.get('db_errors')
  var {user, crypto_key} = this.get('models')

  user.findOne({
    where: {
      $or: [
        {id: req.headers['x-cnsnt-id']},
        {did: req.headers['x-cnsnt-did']}
      ]
    }
  }).then(function(found) {
    if (!found) {
      return Promise.reject({
        error: true,
        status: 404,
        message: 'user record not found',
        body: null
      })
    }
    req.user = found
    return Promise.all([
      crypto_key.findOne({
        where: {
          owner_id: found.id,
          alias: (
            'x-cnsnt-fingerprint' in req.headers ?
            'fingerprint' :
            'client-server-http'
          )
        }
      }),
      crypto_key.findOne({
        where: {
          owner_id: found.id,
          alias: 'eis'
        }
      })
    ])
  }).then(function(found) {
    var [master, eis] = found
    if (!master) {
      return Promise.reject({
        error: true,
        status: 404,
        message: 'crypto_key record not found',
        body: null
      })
    }
    req.user.crypto = master
    if (eis) req.user.eis = eis
    return assertAppActivated.call(OUTER, req, res, next)
  }).catch(function(err) {
    err = errors(err)
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

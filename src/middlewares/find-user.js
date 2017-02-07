
'use strict'

module.exports = function(req, res, next) {
  var {skip_secure_checks, skip_active_checks} = req
  if (skip_active_checks || skip_active_checks) return next()
  var {user} = this.get('models')
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
      return next()
    }
    return Promise.reject({
      error: true,
      status: 404,
      message: 'user record not found',
      body: null
    })
  }).catch(function(err) {
    return res.status(err.status || 500).json({
      error: true,
      status: err.status || 500,
      message: err.message || 'internal server error',
      body: err.body || null
    })
  })
}
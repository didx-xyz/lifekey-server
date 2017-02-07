
'use strict'

module.exports = function(req, res, next) {

  if (!this.get(`active_${req.method.toLowerCase()}_${req.route.path}`)) {
    return next()
  } else if (!req.user) {
    var {user} = this.get('models')
    user.findOne({where: {
      $or: [
        {id: req.headers['x-cnsnt-id']},
        {did: req.headers['x-cnsnt-did']}
      ]
    }}).then(function(found) {
      if (found) {
        req.user = found
        return found.app_activation_link_clicked ? (
          next()
        ) : (
          res.status(400).json({
            error: true,
            status: 400,
            message: 'app not yet activated',
            body: null
          })
        )
      }
      return Promise.reject({
        error: true,
        status: 404,
        message: 'user record not found',
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
  } else if (!req.user.app_activation_link_clicked) {
    return res.status(400).json({
      error: true,
      status: 400,
      message: 'app not yet activated',
      body: null
    })
  } else {
    // all good, otherwise
    return next()
  }
}
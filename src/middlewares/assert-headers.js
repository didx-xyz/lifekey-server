
'use strict'

module.exports = function(req, res, next) {

  // if the matched route is neither secured-only, nor activated-only, skip the middleware
  var is_secure = this.get(`secure_${req.method.toLowerCase()}_${req.route.path}`)
  var is_active = this.get(`active_${req.method.toLowerCase()}_${req.route.path}`)
  if (!(is_active && is_secure)) {
    req.skip_secure_checks = !is_secure
    req.skip_active_checks = !is_active
    return next()
  }

  // otherwise, check the headers
  if (!(('x-cnsnt-id' in req.headers || 'x-cnsnt-did' in req.headers) &&
        'x-cnsnt-plain' in req.headers &&
        'x-cnsnt-signable' in req.headers &&
        'x-cnsnt-signed' in req.headers)) {
    // if missing any of the above
    return res.status(400).json({
      error: true,
      status: 400,
      message: 'authentication parameters missing from request headers',
      body: null
    })
  }
  
  // all good, otherwise
  return next()
}
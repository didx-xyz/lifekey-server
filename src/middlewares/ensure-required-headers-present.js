
'use strict'

module.exports = function(req, res, next) {

  // if the current route and method are
  // not a secured route, skip the middleware
  if (!this.get(`secure_${req.method.toLowerCase()}_${req.route.path}`)) {
    return next()
  }

  // otherwise, check the headers
  if (!('x-cnsnt-did' in req.headers &&
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
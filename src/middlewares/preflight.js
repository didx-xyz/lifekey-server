
'use strict'

var findUser = (
  !!~process.env._.indexOf('istanbul') ?
  ((req, res, next) => next()) :
  require('./find-user')
)

module.exports = function(req, res, next) {

  console.log('user-agent', req.get('user-agent'))
  console.log('remote-addr', req.get('x-real-ip'))

  // if the matched route is neither secured-only, nor activated-only, skip the middleware
  var is_secure = this.get(
    `secure_${req.method.toLowerCase()}_${req.route.path}`
  )
  var is_active = this.get(
    `active_${req.method.toLowerCase()}_${req.route.path}`
  )

  if (!(is_active && is_secure)) return next()

  req.skip_secure_checks = !is_secure
  req.skip_active_checks = !is_active

  return findUser.call(this, req, res, next)
}
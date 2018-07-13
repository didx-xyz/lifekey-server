
'use strict'

var replayAttack = ((process.env._ &&
  !!~process.env._.indexOf('istanbul')) ?
  ((req, res, next) => next()) :
  require('./replay-attack')
)

module.exports = function(req, res, next) {

  var skip_active = req.skip_active_checks
  var skip_secure = req.skip_secure_checks
  var skip_all = skip_active && skip_secure
  var skip_neither = !(skip_active && skip_secure)
  var is_activated = req.user.app_activation_link_clicked

  if (
    (!skip_active && skip_secure && is_activated) ||
    skip_all
  ) return next()

  if (
    (skip_active && !skip_secure) ||
    (skip_neither && is_activated)
  ) return replayAttack.call(this, req, res, next)

  if (!(skip_active && is_activated)) {
    return res.status(400).json({
      error: true,
      status: 400,
      message: 'app not yet activated',
      body: null
    })
  } else {
    return res.status(500).json({
      error: true,
      status: 500,
      message: 'this should not be reachable',
      body: null
    })
  }
}

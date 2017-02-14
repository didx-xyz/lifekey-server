
'use strict'

var replayAttack = (
  !!~process.env._.indexOf('istanbul') ?
  ((req, res, next) => next()) :
  require('./replay-attack')
)

module.exports = function(req, res, next) {

  if ((req.skip_active_checks && req.skip_secure_checks)) {
    return next()
  } else if ((req.skip_active_checks && !req.skip_secure_checks)) {
    return replayAttack.call(this, req, res, next)
  } else if (!(req.skip_active_checks && req.skip_secure_checks) && req.user.app_activation_link_clicked) {
    return replayAttack.call(this, req, res, next)
  } else if (!req.skip_active_checks && req.skip_secure_checks && req.user.app_activation_link_clicked) {
    return next()
  } else if (!(req.skip_active_checks && req.user.app_activation_link_clicked)) {
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
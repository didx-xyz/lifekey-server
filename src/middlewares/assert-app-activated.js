
'use strict'

module.exports = function(req, res, next) {

  if (req.skip_active_checks || req.user.app_activation_link_clicked) {
    return next()
  } else {
    return res.status(400).json({
      error: true,
      status: 400,
      message: 'app not yet activated',
      body: null
    })
  }
}

'use strict'

module.exports = function(req, res, next) {

  if (!this.get(`activated_${req.method.toLowerCase()}_${req.route.path}`)) return next()

  if (!req.user.app_activation_link_clicked) {
    // obscure the reason
    return res.status(400).json({
      error: true,
      status: 400,
      message: 'app not yet activated',
      body: null
    })
  }
  // all good, otherwise
  return next()
}
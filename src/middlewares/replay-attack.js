
'use strict'

module.exports = function(req, res, next) {
  // ensure this signature has not been used already
  var {verification} = this.get('models')
  verification.findOne({
    where: {
      signable: req.headers['x-cnsnt-signable'],
      public_key: req.headers['x-cnsnt-did']
    }
  }).then(function(found) {
    if (found) {
      // gtfo if it has already been used
      return res.status(400).json({
        status: 400,
        error: true,
        message: 'known signature detected'
      })
    }
    return verification.create({
      public_key: req.headers['x-cnsnt-did'],
      signable: req.headers['x-cnsnt-signable'].toString('hex')
    })
  }).catch(function(err) {
    return res.status(500).json({
      status: 500,
      error: true,
      message: 'internal server error'
    })
  }).then(next)
}

'use strict'

var eccrypto = require('eccrypto')

module.exports = function(req, res, next) {
  eccrypto.verify(
    req.headers['x-cnsnt-pubkey'],
    req.headers['x-cnsnt-signable'],
    req.headers['x-cnsnt-signature']
  ).catch(function(err) {
    return res.status(400).json({
      error: true,
      status: 400,
      body: null,
      message: 'signature verification failed'
    })
  }).then(next)
}
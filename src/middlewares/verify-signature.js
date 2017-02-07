
'use strict'

var secp = require('eccrypto')
var rsa = require('ursa')

module.exports = function(req, res, next) {

  // if the current route and method are not a secured route, skip the middleware
  if (req.skip_secure_checks) return next()

  try {
    var b_signable = Buffer.from(req.headers['x-cnsnt-signable'], 'hex')
    var b_signed = Buffer.from(req.headers['x-cnsnt-signed'], 'hex')
  } catch (e) {
    return res.status(400).json({
      error: true,
      status: 400,
      message: 'error hex-parsing any of: x-cnsnt-signable, x-cnsnt-signed',
      body: null
    })
  }

  try {
    var b_plain = Buffer.from(req.headers['x-cnsnt-plain'])
  } catch (e) {
    return res.status(400).json({
      error: true,
      status: 400,
      message: 'error utf8-parsing any of: x-cnsnt-plain',
      body: null
    })
  }

  if (!(b_signable.length && b_signed.length && b_plain.length)) {
    return res.status(400).json({
      error: true,
      status: 400,
      message: 'error parsing any of: x-cnsnt-signable, x-cnsnt-signed, x-cnsnt-plain',
      body: null
    })
  }
  
  // do the verification
  var {algorithm, public_key} = req.user.crypto
  if (algorithm === 'secp256k1') {
    secp.verify(
      req.user.crypto.public_key,
      b_signable,
      b_signed
    ).catch(function() {
      // verification failure
      return res.status(400).json({
        error: true,
        status: 400,
        message: 'signature verification failure',
        body: null
      })
    }).then(next) // all good, otherwise
  } else if (algorithm === 'rsa') {
    return res.status(400).json({
      error: true,
      status: 500, // TODO can this ever happen?
      message: 'rsa not yet implemented',
      body: null
    })
  } else {
    return res.status(400).json({
      error: true,
      status: 500, // TODO can this ever happen?
      message: `unsupported key algorithm ${algorithm}`,
      body: null
    })
  }
  
}
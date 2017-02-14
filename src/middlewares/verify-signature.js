
'use strict'

var secp = require('secp256k1')
var ursa = require('ursa')

// TODO factor our the verification procedures for each scheme so that we can dispatch over specified algorithm using [].indexOf as a guard instead of huge if/else/switch nightmares

module.exports = function(req, res, next) {

  // TODO plaintext repr can be omitted if possible (some schemes may require it)
  var b_plain = Buffer.from(req.headers['x-cnsnt-plain'])

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
    var verified = secp.verify(b_signable, b_signed, req.user.crypto.public_key)
    if (verified) return next()
    return res.status(400).json({
      error: true,
      status: 400,
      message: 'signature verification failure',
      body: null
    })
  } else if (algorithm === 'rsa') {
    try {
      var ursapublickey = ursa.coercePublicKey(req.user.crypto.public_key)
    } catch (e) {
      return res.status(400).json({
        error: true,
        status: 400,
        message: 'parsing of pem-encoded public key failed',
        body: null
      })
    }
    try {
      var verified = ursapublickey.hashAndVerify('sha256', b_plain, b_signed.toString('hex'), 'hex', true)
    } catch (e) {
      return res.status(400).json({
        error: true,
        status: 400,
        message: 'signature verification failure',
        body: null
      })
    }
    if (verified) return next()
    return res.status(400).json({
      error: true,
      status: 400,
      message: 'signature verification failure',
      body: null
    })
  } else {
    return res.status(500).json({
      error: true,
      status: 500, // TODO can this ever happen?
      message: `unsupported key algorithm ${algorithm}`,
      body: null
    })
  }
  
}
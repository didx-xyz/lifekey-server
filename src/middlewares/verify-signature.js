
'use strict'

var crypto = require('crypto')

var secp = require('secp256k1')

module.exports = function(req, res, next) {

  var b_plain = Buffer.from(req.headers['x-cnsnt-plain'])
  var b_signable = crypto.createHash('sha256').update(b_plain).digest()
  var b_signed = Buffer.from(req.headers['x-cnsnt-signed'], 'base64')

  if (!(b_signable.length && b_signed.length && b_plain.length)) {
    return res.status(400).json({
      error: true,
      status: 400,
      message: 'error base64-parsing or shasumming any of: x-cnsnt-plain, x-cnsnt-signed',
      body: null
    })
  }

  var {algorithm, public_key} = req.user.crypto

  if (algorithm === 'secp256k1') {

    var verified = secp.verify(
      b_signable,
      b_signed,
      req.user.crypto.public_key
    )

    if (verified) return next()
    return res.status(400).json({
      error: true,
      status: 400,
      message: 'signature verification failure',
      body: null
    })

  } else if (algorithm === 'rsa') {

    try {
      var verifier = crypto.createVerify('RSA-SHA256')
      verifier.update(b_plain)
      var verified = verifier.verify(req.user.crypto.public_key, b_signed)
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

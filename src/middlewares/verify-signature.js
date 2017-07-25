
'use strict'

var crypto = require('crypto')

var secp = require('secp256k1')
var ursa = require('ursa')

module.exports = function(req, res, next) {

  var b_plain = Buffer.from(req.headers['x-cnsnt-plain'])
  var b_signable = crypto.createHash('sha256').update(b_plain).digest()
  var b_signed = Buffer.from(req.headers['x-cnsnt-signed'], 'base64')

  if (!(b_signable.length && b_signed.length && b_plain.length)) {
    console.log('HEIN debug', 'request header parse fail')
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
    console.log('HEIN debug', 'sig verify fail')
    return res.status(400).json({
      error: true,
      status: 400,
      message: 'signature verification failure',
      body: null
    })

  } else if (algorithm === 'rsa') {

    try {
      var ursapublickey = ursa.coercePublicKey(req.user.crypto.public_key.toString('utf8'))
    } catch (e) {
      console.log('HEIN debug', 'key parse fail')
      return res.status(400).json({
        error: true,
        status: 400,
        message: 'parsing of pem-encoded public key failed',
        body: null
      })
    }

    try {
      var verified = ursapublickey.hashAndVerify(
        'sha256',
        b_plain,
        b_signed.toString('base64'),
        'base64',
        false
      )
    } catch (e) {
      console.log('HEIN debug', 'sig verify fail')
      return res.status(400).json({
        error: true,
        status: 400,
        message: 'signature verification failure',
        body: null
      })
    }

    if (verified) return next()

    console.log('HEIN debug', 'sig verify fail')
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

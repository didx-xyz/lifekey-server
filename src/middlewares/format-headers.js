'use strict'

module.exports = function(req, res, next) {
  // ensure headers are in correct format
  try {
    req.headers['x-cnsnt-signature'] = Buffer.from(req.headers['x-cnsnt-signature'], 'hex')
    req.headers['x-cnsnt-signable'] = Buffer.from(req.headers['x-cnsnt-signable'], 'hex')
  } catch (e) {
    res.status(400)
    return res.json({
      error: true,
      status: 400,
      body: null,
      message: 'x-cnsnt-signature, x-cnsnt-signable is not hexadecimal'
    })
  }
  return next()
}

'use strict'

module.exports = function(req, res, next) {
  // ensure all required headers are present
  if (!('x-cnsnt-did' in req.headers &&
        'x-cnsnt-signable' in req.headers &&
        'x-cnsnt-signature' in req.headers)) {
    return res.status(400).json({
      error: true,
      status: 400,
      body: null,
      message: (
        [
          'x-cnsnt-did',
          'x-cnsnt-signable',
          'x-cnsnt-signature'
        ].join(', ') + 'is missing'
      )
    })
  }
  return next()
}
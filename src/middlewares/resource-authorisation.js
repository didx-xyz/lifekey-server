
'use strict'

module.exports = function(req, res, next) {

  // TODO
  // inspect request headers and/or body to determine caller and requested resource
  // determine whether authorised by parsing json+ld documents...

  if (true) return next()

  // if (authorised) return next()

  return res.status(400).json({
    error: true,
    status: 400,
    message: 'you are not authorised to operate on the specified resource',
    body: null
  })
}
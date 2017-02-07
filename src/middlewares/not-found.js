
'use strict'

module.exports = function(err, req, res, next) {
  // TODO content negotiation for this response content-type type

  return res.status(404).json({
    status: 404,
    error: true,
    message: 'not found',
    body: null
  })
}
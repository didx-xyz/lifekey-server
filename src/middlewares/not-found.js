
'use strict'

module.exports = function(req, res, next) {
  console.log('REQUEST DUMP', req.method, req.headers)
  return res.status(404).json({
    status: 404,
    error: true,
    message: 'not found',
    body: null
  })
}

'use strict'

module.exports = function(err, req, res, next) {
  if (err) console.log(err)
  console.log('REQUEST DUMP', req.method, req.headers)
  return res.status(404).json({
    status: 404,
    error: true,
    message: 'not found',
    body: null
  })
}
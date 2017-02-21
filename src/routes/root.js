
module.exports = [
  {
    uri: '/',
    method: 'get',
    secure: false,
    active: false,
    callback: function(req, res) {
      return res.status(200).json({
        error: false,
        status: 200,
        message: 'sorry, there\'s nothing to see here...',
        body: null
      })
    }
  }
]
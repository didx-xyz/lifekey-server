
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
  },
  {
    uri: '/robots.txt',
    method: 'get',
    secure: false,
    active: false,
    callback: function(req, res) {
      res.set('content-type', 'text/plain')
      return res.status(200).end('User-agent: *\nDisallow: /')
    }
  },
  {
    // /azenv.php?auth=148793672741&a=PSCMN&i=2194886317&p=80
    uri: '/azenv.php',
    method: 'post',
    secure: false,
    active: false,
    callback: function(req, res) {
      var {auth, a, i, p} = req.query
      console.log(req.headers)
      // { connection: 'upgrade',
      // host: 'check.proxyradar.com',
      // 'content-length': '13',
      // cookie: 'testCookie=true',
      // 'user-agent': 'Mozilla/4.0 (compatible; MSIE 8.0; Windows NT 5.1; Trident/4.0)',
      // referer: 'https://proxyradar.com/',
      // 'content-type': 'application/x-www-form-urlencoded' }
      res.status(200).json({
        who: 'are',
        you: 'and',
        how: 'did',
        you: 'get',
        this: 'number?'
      })
    }
  }
]
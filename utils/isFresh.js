var fresh = require('fresh')

const isFresh = (req, res) => {
    return fresh(req.headers, {
      'etag': res.getHeader('ETag'),
      'last-modified': res.getHeader('Last-Modified')
    })
  }

module.exports = {
    isFresh
}




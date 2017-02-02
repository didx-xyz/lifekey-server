
'use strict'

module.exports = {
  express: {
    get: function(prop) {
      if (!this[prop]) {
        throw new Error(
          `expected mock.express['${prop}'] to be truthy. ${JSON.stringify(this)}`
        )
      }
      return this[prop]
    }
  },
  res: function(onend) {
    var mock = {}
    mock.set = function(k, v) {
      return mock
    }
    mock.write = function(w) {
      return mock
    }
    mock.end = function(e) {
      return onend(e)
    }
    mock.status = function(s) {
      return mock
    }
    mock.json = function(j) {
      return onend(j)
    }
    return mock
  }
}
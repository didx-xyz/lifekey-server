
'use strict'

module.exports = {
  express: {
    // vessel for database models (used within route callbacks)
    get: function(prop) {
      return this[prop] || null
    }
  },
  res: function(respond) {
    // route callback response stream
    var mock
    mock = {
      status: function(s) {
        return mock
      },
      json: function(j) {
        return respond(j)
      }
    }
    return mock
  }
}
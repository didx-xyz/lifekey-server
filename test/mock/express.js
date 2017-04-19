
'use strict'

var inst = {}

module.exports = {
  express: {
    set: function(prop, val) {
      inst[prop] = val
    },
    get: function(prop) {
      if (typeof inst[prop] === 'undefined') {
        console.log('trying to get', prop)
        throw new Error(`expected inst.${prop} to be truthy.`)
      }
      return inst[prop]
    }
  },
  res: function(onend) {
    var mock = {}
    mock.emit = function() {
      return true
    }
    mock.once = function() {
      return mock
    }
    mock.prependListener = function() {
      return mock
    }
    mock.on = function() {
      return mock
    }
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
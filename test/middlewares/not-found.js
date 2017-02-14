
'use strict'

var {expect} = require('chai')

var mock = require('../mock/express')
var subject = require('../../src/middlewares/not-found')

describe('middleware not-found', function() {
  it('should respond with 404', function(done) {
    subject.call(mock.express, null, {}, mock.res(function(res) {
      expect(res.error).to.equal(true)
      expect(res.status).to.equal(404)
      expect(res.message).to.equal('not found')
      done()
    }), done.bind(done, new Error('should not be called')))
  })
})
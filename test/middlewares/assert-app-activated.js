
'use strict'

var crypto = require('crypto')

var {expect} = require('chai')

// mock express instance
var mock = require('../mock/express')

// the test subject
var subject = require('../../src/middlewares/assert-app-activated')

describe('middleware assert-app-activated', function() {
  
  it('should invoke the success callback if the request has been flagged as skippable', function(done) {
    subject.call(
      mock.express,
      {skip_active_checks: true},
      done.bind(done, new Error('should not have been called')),
      done
    )
  })

  it('should invoke the success callback if the activation link has been clicked', function(done) {
    subject.call(mock.express, {
      skip_active_checks: false,
      user: {app_activation_link_clicked: true}
    }, done.bind(done, new Error('should not have been called')), done)
  })

  it('should respond with not found if the activation link has not been clicked', function(done) {
    subject.call(mock.express, {
      skip_active_checks: false,
      user: {app_activation_link_clicked: false}
    }, mock.res(function(res) {
      expect(res.error).to.equal(true)
      expect(res.status).to.equal(400)
      expect(res.message).to.equal('app not yet activated')
      done()
    }), done.bind(done, new Error('should not have been called')))
  })
  
})

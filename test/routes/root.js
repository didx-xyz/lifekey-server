
'use strict'

var http = require('http')
var crypto = require('crypto')

var secp = require('secp256k1')

var {expect} = require('chai')

var mock = require('../mock/express')

var routes = require('../../src/routes/root')
var web_auth = routes[3]

describe('root', function() {
  
  describe(`${web_auth.method.toUpperCase()} ${web_auth.uri}`, function() {
    
    it('should fail if missing required arguments', function(done) {
      web_auth.callback.call(mock.express, {
        user: {id: 'baz'},
        body: {}
      }, mock.res(function(res) {
        expect(res.error).to.equal(true)
        expect(res.status).to.equal(400)
        expect(res.message).to.equal('missing required arguments')
        expect(res.body).to.equal(null)
        done()
      }))
    })
    
    it('should return ok if given all required arguments', function(done) {
      web_auth.callback.call(mock.express, {
        user: {id: 'baz'},
        body: {
          challenge: 'foo',
          did: 'bar'
        }
      }, mock.res(function(res) {
        expect(res.error).to.equal(false)
        expect(res.status).to.equal(200)
        expect(res.message).to.equal('ok')
        expect(res.body).to.equal(null)
        done()
      }))
    })
  })
})
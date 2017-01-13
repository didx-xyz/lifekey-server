
var {expect} = require('chai')

describe.skip('firebase cloud messaging', function() {

  describe('envfile', function() {
    // remove env var temporarily for this test case
    var tmp
    before(function() {
      tmp = process.env.NODE_ENV
      process.env.NODE_ENV = ''
    })
    after(function() {
      process.env.NODE_ENV = tmp
    })
    
    it('should fail to load if no execution environment is defined', function() {
      expect(function() {
        require('../../src/messaging/fcm')
      }).to.throw
    })
  })

  var fcm = require('../../src/messaging/fcm')
  
  describe('sending', function() {
    it('should throw if a falsy recipient is given', function() {
      expect(fcm).to.throw
    })
    it('should succeed with 200 from fcm', function(done) {
      fcm('joe-nobody', {
        title: 'abc',
        body: '123'
      }, {
        a: 'b',
        c: 'd'
      }, done)
    })
  })
})
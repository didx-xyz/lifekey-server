

var fs = require('fs')
var path = require('path')

var {expect} = require('chai')

describe('database initialisation', function() {

  describe.skip('envfile', function() {
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
        require('../../src/init/database')
      }).to.throw
    })
  })

  describe('connection and models', function() {

    this.timeout(0) // this one takes a while...

    it('should return a database connection and models', function(done) {
      require('../../src/init/database')(false).then(function(database) {
        fs.readdir(`${__dirname}/../../src/models`, function(err, files) {
          if (err) return done(err)
          expect(database.db).to.be.ok
          expect(database.models).to.be.ok
          expect(Object.keys(database.models).length).to.equal(files.length)
          done()
        })
      }).catch(done)
    })
  })
})

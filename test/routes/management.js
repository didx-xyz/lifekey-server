
'use strict'

var {expect} = require('chai')

// mock express instance
var mock = require('../mock/express')

// the test subject
var routes = require('../../src/routes/management')

before(function(done) {
  this.timeout(0)
  require('../../src/init/database')(
    false // disable sql logging
  ).then(function(database) {
    mock.express.models = database.models
    done()
  }).catch(done)
})

describe('management endpoints', function() {

  this.timeout(10000) // these cases do real database calls
                      // increase the timeout to cover for this
  
  // user record fixtures
  var respondid
  var test_user = {
    email: `u_1${Date.now()}@example.com`,
    password: 'user',
    token: null,
    id: null
  }

  var test_user2 = {
    email: `u_2${Date.now()}@example.com`,
    password: 'user',
    token: null,
    id: null
  }

  var respondid2
  var test_user3 = {
    email: `u_3${Date.now()}@example.com`,
    password: 'user',
    token: null,
    id: null
  }

  var test_user4 = {
    email: `u_4${Date.now()}@example.com`,
    password: 'user',
    token: null,
    id: null
  }


  describe(`${routes[0].method.toUpperCase()} ${routes[0].uri}`, function() {
    
    it('should fail if required parameters are missing', function(done) {
      routes[0].callback.call(mock.express, {
        body: {email: test_user.email}
      }, mock.res(function(res) {
        // missing password
        expect(res.status).to.equal(400)

        routes[0].callback.call(mock.express, {
          body: {password: test_user.password}
        }, mock.res(function(res) {
          // missing email
          expect(res.status).to.equal(400)

          routes[0].callback.call(mock.express, {
            body: {}
          }, mock.res(function(res) {
            // missing everything
            expect(res.status).to.equal(400)
            
            done()
          }))
        }))
      }))
    })
    it('should insert a new user record if required arguments are given', function(done) {
      routes[0].callback.call(mock.express, {
        body: {
          email: test_user.email,
          password: test_user.password
        }
      }, mock.res(function(res) {
        expect(res.status).to.equal(201)
        test_user.id = res.body.id
        done()
      }))
    })
    it('should fail if an attempt to create a duplicate user is made', function(done) {
      routes[0].callback.call(mock.express, {
        body: {
          email: test_user.email,
          password: test_user.password
        }
      }, mock.res(function(res) {
        expect(res.status).to.equal(400)
        expect(res.message).to.equal('user already exists')
        done()
      }))
    })
  })

  describe(`${routes[1].method.toUpperCase()} ${routes[1].uri}`, function() {

    var passed = false
    
    after(function(done) {

      if (!passed) return done(new Error('cannot set-up subsequent fixture data'))

      // set up fixture data (user registrations)

      var register = routes[0].callback.bind(mock.express)
      var token = routes[1].callback.bind(mock.express)

      register({
        body: {
          email: test_user2.email,
          password: test_user2.password
        }
      }, mock.res(function(res) {
        
        if (res.status !== 201) {
          return done(new Error('user2 creation failed'))
        }
        
        // store for test case
        test_user2.id = res.body.id

        // then, get a token
        token({
          body: {
            email: test_user2.email,
            password: test_user2.password
          }
        }, mock.res(function(res) {
          
          if (res.status !== 200) {
            return done(new Error('token2 creation failed'))
          }
          
          // store for test case
          test_user2.token = res.body.token

          // first, register
          register({
            body: {
              email: test_user3.email,
              password: test_user3.password
            }
          }, mock.res(function(res) {
            
            if (res.status !== 201) {
              return done(new Error('user3 creation failed'))
            }
            
            // store for test case
            test_user3.id = res.body.id

            // then, get a token
            token({
              body: {
                email: test_user3.email,
                password: test_user3.password
              }
            }, mock.res(function(res) {
              
              if (res.status !== 200) {
                return done(new Error('token3 creation failed'))
              }
              
              // store for test case
              test_user3.token = res.body.token

              // first, register
              register({
                body: {
                  email: test_user4.email,
                  password: test_user4.password
                }
              }, mock.res(function(res) {
                
                if (res.status !== 201) {
                  return done(new Error('user4 creation failed'))
                }
                
                // store for test case
                test_user4.id = res.body.id

                // then, get a token
                token({
                  body: {
                    email: test_user4.email,
                    password: test_user4.password
                  }
                }, mock.res(function(res) {
                  
                  if (res.status !== 200) {
                    return done(new Error('token4 creation failed'))
                  }
                  
                  // store for test case
                  test_user4.token = res.body.token

                  // we're ready!
                  done()
                }))
              }))
            }))
          }))
        }))
      }))

    })

    it('should not insert a new token if the given user record is not found', function(done) {
      routes[1].callback.call(mock.express, {
        body: {
          email: 'not a user record',
          password: 'the wrong password'
        }
      }, mock.res(function(res) {
        expect(res.status).to.equal(404)
        done()
      }))
    })
    it('should not insert a new token record if given password is not verified', function(done) {
      routes[1].callback.call(mock.express, {
        body: {
          email: test_user.email,
          password: 'the wrong password'
        }
      }, mock.res(function(res) {
        expect(res.status).to.equal(403)
        done()
      }))
    })
    it('should insert a new token record if given password is verified', function(done) {
      routes[1].callback.call(mock.express, {
        body: {
          email: test_user.email,
          password: test_user.password
        }
      }, mock.res(function(res) {
        expect(res.status).to.equal(200)
        expect(res.body.token).to.be.ok
        expect(res.body.expires_at).to.be.ok

        // for subsequent tests
        passed = true
        test_user.token = res.body.token

        done()
      }))
    })
  })

  describe(`${routes[2].method.toUpperCase()} ${routes[2].uri}`, function() {
    
    it('should not allow the upsertion of a device record if invalid email is provided', function(done) {
      routes[2].callback.call(mock.express, {
        body: {
          email: 'not correct',
          token: test_user.token,
          device_id: 'abc123',
          platform: 'apple'
        }
      }, mock.res(function(res) {
        expect(res.status).to.equal(404)
        expect(res.message).to.equal('user not found')
        done()
      }))
    })

    it('should not allow the upsertion of a device record if invalid token is provided', function(done) {
      routes[2].callback.call(mock.express, {
        body: {
          email: test_user.email,
          token: 'not correct',
          device_id: 'abc123',
          platform: 'apple'
        }
      }, mock.res(function(res) {
        expect(res.status).to.equal(404)
        expect(res.message).to.equal('token not found')
        done()
      }))
    })

    it('should allow the upsertion of a device record if valid email and token are provided', function(done) {
      routes[2].callback.call(mock.express, {
        body: {
          email: test_user.email,
          token: test_user.token,
          device_id: 'abc123',
          platform: 'apple'
        }
      }, mock.res(function(res) {
        expect(res.status).to.equal(200)
        done()
      }))
    })
  })

  describe(`${routes[3].method.toUpperCase()} ${routes[3].uri}`, function() {
    
    var create_cr = routes[3].callback.bind(mock.express)

    it('should create a user connection request (NOT using jsonld)', function(done) {

      create_cr({
        body: {
          email: test_user2.email,
          token: test_user2.token,
          target: test_user.id // send connect request to user from initial test cases
        }
      }, mock.res(function(res) {
        expect(res.status).to.equal(200)
        done()
      }))
    })
    it('should create a user connection request (using jsonld)', function(done) {

      var document = {
        "@context": "http://schema.cnsnt.io/connection_request",
        "@type": "ConnectionRequest",
        "from": test_user3.id,
        "to": test_user4.id,
        "resolution": null,
        "dateAcknowledged": null,
        "dateResolved": null,
        "resolverSignature": null // FIXME - has to use verifiable sigs eventually
      }

      create_cr({
        body: {
          email: test_user3.email,
          token: test_user3.token,
          document: JSON.stringify(document) // send connect request to user from initial test cases
        }
      }, mock.res(function(res) {
        expect(res.status).to.equal(200)
        done()
      }))
    })
    
  })

  describe(`${routes[4].method.toUpperCase()} ${routes[4].uri}`, function() {
    var get_crs = routes[4].callback.bind(mock.express)
    it('should return arrays of unacknowledged connection requests and enabled connections', function(done) {
      get_crs({
        body: {
          email: test_user.email,
          token: test_user.token
        }
      }, mock.res(function(res) {
        
        expect(res.status).to.equal(200)
        
        expect(res.body.unacked).to.be.ok
        expect(res.body.unacked.length).to.equal(1)

        // for use in subsequent test case
        respondid = res.body.unacked[0].id
        
        expect(res.body.enabled).to.be.ok
        expect(res.body.enabled.length).to.equal(0)
        done()
      }))
    })
  })

  describe(`${routes[5].method.toUpperCase()} ${routes[5].uri}`, function() {
    var get_crs = routes[4].callback.bind(mock.express)
    var respond_to_cr = routes[5].callback.bind(mock.express)

    it('should accept the user connection request without error (NOT using jsonld)', function(done) {
      respond_to_cr({
        params: {id: respondid}, // url parameter representing the user connection request identifier
        body: {
          email: test_user.email,
          token: test_user.token,
          accepted: true // user accepts the connection request
        }
      }, mock.res(function(res) {

        // assert that the acceptance was successful
        expect(res.status).to.equal(200)

        // enumerate list of connections again to assert correct
        get_crs({
          body: {
            email: test_user.email,
            token: test_user.token
          }
        }, mock.res(function(res) {

          expect(res.status).to.equal(200)

          expect(res.body.unacked).to.be.ok
          expect(res.body.unacked.length).to.equal(0)

          expect(res.body.enabled).to.be.ok
          expect(res.body.enabled.length).to.equal(1)

          done()
        }))
      }))
    })
    it('should accept the user connection request without error (using jsonld)', function(done) {

      before(function(done) {
        get_crs({
          body: {
            email: test_user4.email,
            token: test_user4.token
          }
        }, mock.res(function(res) {
          
          expect(res.status).to.equal(200)
          
          expect(res.body.unacked).to.be.ok
          expect(res.body.unacked.length).to.equal(1)

          // for use in subsequent test case
          respondid2 = res.body.unacked[1].id
          
          expect(res.body.enabled).to.be.ok
          expect(res.body.enabled.length).to.equal(0)
          done()
        }))
      })

      var document = {
        "@context": "http://schema.cnsnt.io/connection_request",
        "@type": "ConnectionRequest",
        "from": test_user3.id,
        "to": test_user4.id,
        "resolution": null,
        "dateAcknowledged": null,
        "dateResolved": null,
        "resolverSignature": null // FIXME - has to use verifiable sigs eventually
      }

      // resolve the document
      document.resolution = true
      document.dateAcknowledged = new Date().toISOString()
      document.dateResolved = new Date().toISOString()
      document.resolverSignature = 'pork and beans'

      respond_to_cr({
        params: {id: respondid2}, // url parameter representing the user connection request identifier
        body: {
          email: test_user4.email,
          token: test_user4.token,
          document: JSON.stringify(document)
        }
      }, mock.res(function(res) {

        // assert that the acceptance was successful
        expect(res.status).to.equal(200)

        // enumerate list of connections again to assert correct
        get_crs({
          body: {
            email: test_user4.email,
            token: test_user4.token
          }
        }, mock.res(function(res) {

          expect(res.status).to.equal(200)

          expect(res.body.unacked).to.be.ok
          expect(res.body.unacked.length).to.equal(0)

          expect(res.body.enabled).to.be.ok
          expect(res.body.enabled.length).to.equal(1)

          done()
        }))
      }))
    })
  })
})
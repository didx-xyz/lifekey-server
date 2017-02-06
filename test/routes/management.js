
'use strict'

var crypto = require('crypto')

var ec = require('eccrypto')
var {expect} = require('chai')

// mock express instance
var mock = require('../mock/express')

// the test subject
var routes = require('../../src/routes/management')

// user record fixtures
var now = Date.now()
var respondid, respondid2 // sender of connection requests
var update_uc, update_uc2
var test_users = [
  {
    email: `u_1${now}@example.com`,
    nickname: `u_1${now}`,
    device_id: `u_1${now}`,
    device_platform: 'android',
    public_key_algorithm: 'secp256k1',
    public_key: '',
    plaintext_proof: `u_1${now}`,
    signable_proof: crypto.createHash('sha256').update(`u_1${now}`).digest(),
    signed_proof: ''
  },
  {
    email: `u_2${now}@example.com`,
    nickname: `u_2${now}`,
    device_id: `u_2${now}`,
    device_platform: 'android',
    public_key_algorithm: 'secp256k1',
    public_key: '',
    plaintext_proof: `u_2${now}`,
    signable_proof: crypto.createHash('sha256').update(`u_2${now}`).digest(),
    signed_proof: ''
  },
  {
    email: `u_3${now}@example.com`,
    nickname: `u_3${now}`,
    device_id: `u_3${now}`,
    device_platform: 'ios',
    public_key_algorithm: 'secp256k1',
    public_key: '',
    plaintext_proof: `u_3${now}`,
    signable_proof: crypto.createHash('sha256').update(`u_3${now}`).digest(),
    signed_proof: ''
  },
  {
    email: `u_4${now}@example.com`,
    nickname: `u_4${now}`,
    device_id: `u_4${now}`,
    device_platform: 'ios',
    public_key_algorithm: 'secp256k1',
    public_key: '',
    plaintext_proof: `u_4${now}`,
    signable_proof: crypto.createHash('sha256').update(`u_4${now}`).digest(),
    signed_proof: ''
  }
]

var test_users_fail_cases = [
  // mgmt_register - user already exists case
  {
    email: `u_1${now}@example.com`,
    nickname: `u_1${now}`,
    device_id: `u_1${now}2`,
    device_platform: 'android',
    public_key_algorithm: 'secp256k1',
    public_key: 'abc123',
    plaintext_proof: `u_1${now}`,
    signable_proof: 'abc123',
    signed_proof: 'abc123'
  },
  // mgmt_register - non-hex case
  {
    email: `u_5${now}@example.com`,
    nickname: `u_5${now}`,
    device_id: `u_5${now}2`,
    device_platform: 'android',
    public_key_algorithm: 'secp256k1',
    public_key: 'qux',
    plaintext_proof: 'qux',
    signable_proof: 'qux',
    signed_proof: 'qux'
  },
  // mgmt_register - unsupported algorithm
  {
    email: `u_5${now}@example.com`,
    nickname: `u_5${now}`,
    device_id: `u_5${now}2`,
    device_platform: 'android',
    public_key_algorithm: 'lasdlfkjasldf',
    public_key: 'qux',
    plaintext_proof: 'qux',
    signable_proof: 'qux',
    signed_proof: 'qux'
  }
]

before(function(done) {
  // initialising the models takes ages :/
  this.timeout(30000)

  require('../../src/init/database')(
    false // disable sql logging
  ).then(function(database) {
    mock.express.models = database.models
    console.log('✓ initialised database models')
    return Promise.resolve()
  }).then(function() {
    test_users[0].private_key = crypto.randomBytes(32)
    test_users[1].private_key = crypto.randomBytes(32)
    test_users[2].private_key = crypto.randomBytes(32)
    test_users[3].private_key = crypto.randomBytes(32)
    console.log('✓ generated private keys')
    return Promise.resolve()
  }).then(function() {
    return Promise.all([
      ec.getPublic(test_users[0].private_key),
      ec.getPublic(test_users[1].private_key),
      ec.getPublic(test_users[2].private_key),
      ec.getPublic(test_users[3].private_key)
    ])
  }).then(function(public_keys) {
    console.log('✓ calculated public keys')
    test_users[0].public_key = public_keys[0].toString('hex')
    test_users[1].public_key = public_keys[1].toString('hex')
    test_users[2].public_key = public_keys[2].toString('hex')
    test_users[3].public_key = public_keys[3].toString('hex')
    console.log('✓ hexified public keys')
    return Promise.resolve()
  }).then(function() {
    return Promise.all([
      ec.sign(test_users[0].private_key, test_users[0].signable_proof),
      ec.sign(test_users[1].private_key, test_users[1].signable_proof),
      ec.sign(test_users[2].private_key, test_users[2].signable_proof),
      ec.sign(test_users[3].private_key, test_users[3].signable_proof)
    ])
  }).then(function(signatures) {
    console.log('✓ signed initial key proofs')
    test_users[0].signed_proof = signatures[0].toString('hex')
    test_users[1].signed_proof = signatures[1].toString('hex')
    test_users[2].signed_proof = signatures[2].toString('hex')
    test_users[3].signed_proof = signatures[3].toString('hex')
    console.log('✓ hexified signed proofs')
    return Promise.resolve()
  }).then(function() {
    test_users[0].signable_proof = test_users[0].signable_proof.toString('hex')
    test_users[1].signable_proof = test_users[1].signable_proof.toString('hex')
    test_users[2].signable_proof = test_users[2].signable_proof.toString('hex')
    test_users[3].signable_proof = test_users[3].signable_proof.toString('hex')
    console.log('✓ hexified signable proofs')
    console.log('✓ before done')
    done()
  }).catch(done)
})

describe('management endpoints', function() {

  this.timeout(10000) // these cases do real database calls
                      // increase the timeout to cover for this
  
  var mgmt_register = routes[0]
  var mgmt_device = routes[1]
  var mgmt_connection_create = routes[2]
  var mgmt_connection_list = routes[3]
  var mgmt_connection_respond = routes[4]
  var mgmt_connection_update = routes[5]
  var mgmt_app_activate = routes[6]
  var mgmt_isa_create = routes[7]
  var mgmt_isa_respond = routes[8]

  describe(`${mgmt_register.method.toUpperCase()} ${mgmt_register.uri}`, function() {

    after(function(done) {
      // register the other users once this unit is finished
      mgmt_register.callback.call(mock.express, {
        body: test_users[1]
      }, mock.res(function(res) {
        
        if (!res.body.id) return done(new Error('should not be called'))
        test_users[1].id = res.body.id
        
        mgmt_register.callback.call(mock.express, {
          body: test_users[2]
        }, mock.res(function(res) {
          if (!res.body.id) return done(new Error('should not be called'))
          test_users[2].id = res.body.id
          
          mgmt_register.callback.call(mock.express, {
            body: test_users[3]
          }, mock.res(function(res) {
            if (!res.body.id) return done(new Error('should not be called'))
            test_users[3].id = res.body.id
            
            // DONE!
            done()
          }))
        }))
      }))
    })
    
    it('should fail if required parameters are missing', function(done) {
      mgmt_register.callback.call(mock.express, {
        body: {}
      }, mock.res(function(res) {
        expect(res.status).to.equal(400)
        expect(res.message).to.equal('missing request body parameters')
        done()
      }))
    })

    it('should insert a new user record if required arguments are given and respond with basic identifier', function(done) {
      mgmt_register.callback.call(mock.express, {
        body: test_users[0]
      }, mock.res(function(res) {
        expect(res.status).to.equal(201)
        expect(typeof res.body).to.equal('object')
        expect(typeof res.body.id).to.equal('number')
        test_users[0].id = res.body.id
        done()
      }))
    })

    it('should fail if an attempt to create a user with a duplicate signature is used', function(done) {
      mgmt_register.callback.call(mock.express, {
        body: test_users[0]
      }, mock.res(function(res) {
        expect(res.status).to.equal(400)
        expect(res.message).to.equal('known signature detected')
        done()
      }))
    })

    it('should fail if an attempt to create a duplicate user is made', function(done) {
      mgmt_register.callback.call(mock.express, {
        body: test_users_fail_cases[0]
      }, mock.res(function(res) {
        expect(res.status).to.equal(400)
        expect(res.message).to.equal('user already exists')
        done()
      }))
    })

    it('should fail if non-hexadecimal key parameters are given', function(done) {
      mgmt_register.callback.call(mock.express, {
        body: test_users_fail_cases[1]
      }, mock.res(function(res) {
        expect(res.status).to.equal(400)
        expect(res.message).to.equal('hexadecimal parsing error in any of: public_key, signable_proof, signed_proof')
        done()
      }))
    })

    it('should fail if an unsupported algorithm is used', function(done) {
      mgmt_register.callback.call(mock.express, {
        body: test_users_fail_cases[2]
      }, mock.res(function(res) {
        expect(res.status).to.equal(400)
        expect(res.message).to.equal('unsupported key algorithm')
        done()
      }))
    })
  })

  describe(`${mgmt_device.method.toUpperCase()} ${mgmt_device.uri}`, function() {
    
    it('should not allow the upsertion of a user_device record if required arguments are missing', function(done) {
      mgmt_device.callback.call(mock.express, {
        user: {id: test_users[0].id},
        body: {}
      }, mock.res(function(res) {
        expect(res.status).to.equal(400)
        expect(res.message).to.equal('missing request body parameters')
        done()
      }))
    })

    it('should allow the upsertion of a user_device record if all required arguments are given', function(done) {
      mgmt_device.callback.call(mock.express, {
        user: {id: test_users[0].id},
        body: {
          device_id: Date.now() + 'abc1232342asd',
          device_platform: 'ios'
        }
      }, mock.res(function(res) {
        expect(res.status).to.equal(200)
        expect(res.message).to.equal('device_id saved')
        done()
      }))
    })
  })

  describe(`${mgmt_connection_create.method.toUpperCase()} ${mgmt_connection_create.uri}`, function() {
    
    it('should fail if required arguments are missing', function(done) {
      mgmt_connection_create.callback.call(mock.express, {
        user: {id: test_users[0].id},
        body: {}
      }, mock.res(function(res) {
        expect(res.status).to.equal(400)
        expect(res.message).to.equal('missing request body parameters')
        done()
      }))
    })

    it('should fail for unparsable document', function(done) {
      mgmt_connection_create.callback.call(mock.express, {
        user: {id: test_users[0].id},
        body: {document: 'lasjfdljasdfljksdfj'}
      }, mock.res(function(res) {
        expect(res.status).to.equal(400)
        expect(res.message).to.equal('expected well-formed and validatable json string')
        done()
      }))
    })
    
    it('should disallow self-association', function(done) {
      mgmt_connection_create.callback.call(mock.express, {
        user: {id: test_users[0].id},
        body: {target: test_users[0].id}
      }, mock.res(function(res) {
        expect(res.status).to.equal(400)
        expect(res.message).to.equal('you cannot connect to yourself')
        done()
      }))
    })

    it('should create a user connection request (NOT using jsonld)', function(done) {
      mgmt_connection_create.callback.call(mock.express, {
        user: {id: test_users[0].id},
        body: {target: test_users[1].id}
      }, mock.res(function(res) {
        expect(res.status).to.equal(201)
        expect(typeof res.body).to.equal('object')
        expect(typeof res.body.id).to.equal('number')
        expect(res.message).to.equal('user_connection_request record created')
        respondid = res.body.id
        done()
      }))
    })

    it('should create a user connection request (using jsonld)', function(done) {
      var document = {
        "@context": "http://schema.cnsnt.io/connection_request",
        "@type": "ConnectionRequest",
        "from": test_users[2].id,
        "to": test_users[3].id,
        "resolution": null,
        "dateAcknowledged": null,
        "dateResolved": null,
        "resolverSignature": null
      }

      mgmt_connection_create.callback.call(mock.express, {
        user: {id: test_users[2].id},
        body: {document: JSON.stringify(document)}
      }, mock.res(function(res) {
        expect(res.status).to.equal(201)
        expect(res.message).to.equal('user_connection_request record created')
        respondid2 = res.body.id
        done()
      }))
    })
    
  })

  describe(`${mgmt_connection_list.method.toUpperCase()} ${mgmt_connection_list.uri}`, function() {
    it('should return arrays of unacknowledged connection requests and enabled connections', function(done) {
      mgmt_connection_list.callback.call(mock.express, {
        user: {id: test_users[1].id}
      }, mock.res(function(res) {
        expect(res.status).to.equal(200)
        expect(Array.isArray(res.body.unacked)).to.be.ok
        expect(res.body.unacked.length).to.equal(1)
        expect(res.body.unacked[0]).to.equal(respondid)
        expect(Array.isArray(res.body.enabled)).to.be.ok
        expect(res.body.enabled.length).to.equal(0)
        
        mgmt_connection_list.callback.call(mock.express, {
          user: {id: test_users[3].id}
        }, mock.res(function(res) {
          expect(res.status).to.equal(200)
          expect(Array(res.body.unacked)).to.be.ok
          expect(res.body.unacked.length).to.equal(1)
          expect(res.body.unacked[0]).to.equal(respondid2)
          expect(Array.isArray(res.body.enabled)).to.be.ok
          expect(res.body.enabled.length).to.equal(0)

          done()
        }))
      }))
    })
  })

  describe(`${mgmt_connection_respond.method.toUpperCase()} ${mgmt_connection_respond.uri}`, function() {
    it('should fail if required arguments are missing', function(done) {
      mgmt_connection_respond.callback.call(mock.express, {
        params: {user_connection_request_id: respondid},
        user: {id: test_users[1].id},
        body: {}
      }, mock.res(function(res) {
        expect(res.status).to.equal(400)
        expect(res.message).to.equal('missing request body parameters')
        done()
      }))
    })

    it('should accept the user connection request without error (NOT using jsonld)', function(done) {
      mgmt_connection_respond.callback.call(mock.express, {
        params: {user_connection_request_id: respondid},
        user: {id: test_users[1].id},
        body: {accepted: true}
      }, mock.res(function(res) {

        // assert that the acceptance was successful
        expect(res.status).to.equal(201)
        expect(res.message).to.equal('user_connection created')
        expect(typeof res.body).to.equal('object')
        expect(typeof res.body.id).to.equal('number')
        update_uc = res.body.id

        // enumerate list of connections again to assert correct
        mgmt_connection_list.callback.call(mock.express, {
          user: {id: test_users[1].id}
        }, mock.res(function(res) {
          expect(res.status).to.equal(200)
          expect(Array.isArray(res.body.unacked)).to.be.ok
          expect(res.body.unacked.length).to.equal(0)
          expect(Array.isArray(res.body.enabled)).to.be.ok
          expect(res.body.enabled.length).to.equal(1)
          done()
        }))
      }))
    })

    it('should accept the user connection request without error (using jsonld)', function(done) {
      var now = new Date().toISOString()
      var resolved_document = {
        "@context": "http://schema.cnsnt.io/connection_request",
        "@type": "ConnectionRequest",
        from: test_users[2].id,
        to: test_users[3].id,
        resolution: true,
        dateAcknowledged: now,
        dateResolved: now
      }

      mgmt_connection_respond.callback.call(mock.express, {
        params: {user_connection_request_id: respondid2},
        user: {id: test_users[3].id},
        body: {document: JSON.stringify(resolved_document)}
      }, mock.res(function(res) {

        // assert that the acceptance was successful
        expect(res.status).to.equal(201)
        expect(res.message).to.equal('user_connection created')
        expect(typeof res.body).to.equal('object')
        expect(typeof res.body.id).to.equal('number')
        update_uc2 = res.body.id

        // enumerate list of connections again to assert correct
        mgmt_connection_list.callback.call(mock.express, {
          user: {id: test_users[3].id}
        }, mock.res(function(res) {
          expect(res.status).to.equal(200)
          expect(Array.isArray(res.body.unacked)).to.be.ok
          expect(res.body.unacked.length).to.equal(0)
          expect(Array.isArray(res.body.enabled)).to.be.ok
          expect(res.body.enabled.length).to.equal(1)

          done()
        }))
      }))
    })
  })

  describe(`${mgmt_connection_update.method.toUpperCase()} ${mgmt_connection_update.uri}`, function() {
    it('should fail if required arguments are missing', function(done) {
      mgmt_connection_update.callback.call(mock.express, {
        params: {user_connection_id: update_uc},
        user: {id: test_users[0].id},
        body: {}
      }, mock.res(function(res) {
        expect(res.status).to.equal(400)
        expect(res.message).to.equal('missing request body parameters')
        done()
      }))
    })

    it('should return not found if the user is not associated to the record', function(done) {
      mgmt_connection_update.callback.call(mock.express, {
        params: {user_connection_id: update_uc},
        user: {id: Number.MAX_VALUE},
        body: {enabled: false}
      }, mock.res(function(res) {
        expect(res.status).to.equal(404)
        expect(res.message).to.equal('user_connection record not found')
        done()
      }))
    })

    it('should return no-op if the request would not change the record', function(done) {
      mgmt_connection_update.callback.call(mock.express, {
        params: {user_connection_id: update_uc},
        user: {id: test_users[0].id},
        body: {enabled: true}
      }, mock.res(function(res) {
        expect(res.status).to.equal(400)
        expect(res.message).to.equal('no-op')
        done()
      }))
    })
    
    it('should update the user_connection record enabled bit to the given value', function(done) {
      mgmt_connection_update.callback.call(mock.express, {
        params: {user_connection_id: update_uc},
        user: {id: test_users[0].id},
        body: {enabled: false}
      }, mock.res(function(res) {
        expect(res.status).to.equal(200)
        expect(res.message).to.equal('user_connection record updated')
        done()
      }))
    })
  })

  describe(`${mgmt_app_activate.method.toUpperCase()} ${mgmt_app_activate.uri}`, function() {
    
    var activation_code
    before(function(done) {
      mock.express.models.user.findOne({
        where: {id: test_users[0].id}
      }).then(function(found) {
        if (found) {
          activation_code = found.app_activation_code
          return done()
        }
        return done(new Error('should not be called'))
      }).catch(done)
    })

    it('should update the app_activation_link_clicked bit to enabled if not yet enabled and respond with html string', function(done) {
      mgmt_app_activate.callback.call(mock.express, {
        params: {activation_code: activation_code}
      }, mock.res(function(res) {
        expect(typeof res).to.equal('string')
        done()
      }))
    })

    it('should respond with not found if link already clicked', function(done) {
      mgmt_app_activate.callback.call(mock.express, {
        params: {activation_code: activation_code}
      }, mock.res(function(res) {
        expect(res.status).to.equal(404)
        expect(res.message).to.equal('unknown activation code')
        done()
      }))
    })

    it('should respond with not found if unknown code is given', function(done) {
      mgmt_app_activate.callback.call(mock.express, {
        params: {activation_code: 'lajsdflkajsdlkfjsl'}
      }, mock.res(function(res) {
        expect(res.status).to.equal(404)
        expect(res.message).to.equal('unknown activation code')
        done()
      }))
    })
  })

  describe.skip(`${mgmt_isa_create.method.toUpperCase()} ${mgmt_isa_create.uri}`, function() {
    it('should throw an error if required arguments are missing', function(done) {

    })

    it('should create a information_sharing_agreement record if all required arguments are given and respond with the record identifier', function(done) {

    })
  })

  describe.skip(`${mgmt_isa_respond.method.toUpperCase()} ${mgmt_isa_respond.uri}`, function() {
    it('should throw an error if required arguments are missing', function(done) {

    })
    it('should update the information_sharing_agreement record\'s resolution field', function(done) {

    })
  })
})
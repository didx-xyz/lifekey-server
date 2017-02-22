
'use strict'

var crypto = require('crypto')

var ec = require('eccrypto')
var rsa = require('ursa')
var {expect} = require('chai')

// mock express instance
var mock = require('../mock/express')

// the test subject
var routes = require('../../src/routes/management')

// user record fixtures
var now = Date.now()
var respondid, respondid2 // sender of connection requests
var isar_respond1, isar_respond2
var created_isa_id
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
    public_key_algorithm: 'rsa',
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
    public_key_algorithm: 'rsa',
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
    mock.express.set('env', {
      _: process.env._,
      SERVER_HOSTNAME: 'localhost'
    })
    mock.express.set('models', database.models)
    console.log('✓ initialised database models')
    return Promise.resolve()
  }).then(function() {
    test_users[0].private_key = crypto.randomBytes(32)
    test_users[1].private_key = crypto.randomBytes(32)
    test_users[2].private_key = rsa.generatePrivateKey()
    test_users[3].private_key = rsa.generatePrivateKey()
    console.log('✓ generated private keys')
    return Promise.resolve()
  }).then(function() {
    return Promise.all([
      ec.getPublic(test_users[0].private_key),
      ec.getPublic(test_users[1].private_key),
      test_users[2].private_key.toPublicPem().toString('utf8'),
      test_users[3].private_key.toPublicPem().toString('utf8')
    ])
  }).then(function(public_keys) {
    console.log('✓ calculated public keys')
    test_users[0].public_key = public_keys[0].toString('base64')
    test_users[1].public_key = public_keys[1].toString('base64')
    test_users[2].public_key = public_keys[2]
    test_users[3].public_key = public_keys[3]
    console.log('✓ base64ified public keys')
    return Promise.resolve()
  }).then(function() {
    return Promise.all([
      ec.sign(test_users[0].private_key, test_users[0].signable_proof),
      ec.sign(test_users[1].private_key, test_users[1].signable_proof),
      test_users[2].private_key.hashAndSign('sha256', test_users[2].plaintext_proof, 'utf8', 'base64', false),
      test_users[3].private_key.hashAndSign('sha256', test_users[3].plaintext_proof, 'utf8', 'base64', false)
    ])
  }).then(function(signatures) {
    console.log('✓ signed initial key proofs')
    test_users[0].signed_proof = signatures[0].toString('base64')
    test_users[1].signed_proof = signatures[1].toString('base64')
    test_users[2].signed_proof = signatures[2]
    test_users[3].signed_proof = signatures[3]
    console.log('✓ base64ified signed proofs')
    return Promise.resolve()
  }).then(function() {
    test_users[0].signable_proof = test_users[0].signable_proof.toString('hex')
    test_users[1].signable_proof = test_users[1].signable_proof.toString('hex')
    test_users[2].signable_proof = test_users[2].signable_proof.toString('hex')
    test_users[3].signable_proof = test_users[3].signable_proof.toString('hex')
    console.log('✓ base64ified signable proofs')
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
  var mgmt_isar_create = routes[7]
  var mgmt_isar_respond = routes[8]
  var mgmt_isa_list = routes[9]
  var mgmt_isa_getone = routes[10]
  var mgmt_isa_remove = routes[11]

  describe(`${mgmt_register.method.toUpperCase()} ${mgmt_register.uri}`, function() {

    after(function(done) {
      // register the other users once this unit is finished
      mgmt_register.callback.call(mock.express, {
        body: test_users[1]
      }, mock.res(function(res) {
        if (res.status !== 201) {
          return done(new Error('should not be called'))
        }
        test_users[1].id = res.body.id
        
        mgmt_register.callback.call(mock.express, {
          body: test_users[2]
        }, mock.res(function(res) {
          if (res.status !== 201) {
            return done(new Error('should not be called'))
          }
          test_users[2].id = res.body.id
          
          mgmt_register.callback.call(mock.express, {
            body: test_users[3]
          }, mock.res(function(res) {
            if (res.status !== 201) {
              return done(new Error('should not be called'))
            }
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

    it('should fail if non-signature key parameters are given', function(done) {
      mgmt_register.callback.call(mock.express, {
        body: test_users_fail_cases[1]
      }, mock.res(function(res) {
        expect(res.status).to.equal(400)
        expect(res.message).to.equal('non-signature value given')
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
        expect(res.body.unacked[0].id).to.equal(respondid)
        expect(Array.isArray(res.body.enabled)).to.be.ok
        expect(res.body.enabled.length).to.equal(0)
        
        mgmt_connection_list.callback.call(mock.express, {
          user: {id: test_users[3].id}
        }, mock.res(function(res) {
          expect(res.status).to.equal(200)
          expect(Array(res.body.unacked)).to.be.ok
          expect(res.body.unacked.length).to.equal(1)
          expect(res.body.unacked[0].id).to.equal(respondid2)
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
        
        // reset the value for subsequent tests
        mgmt_connection_update.callback.call(mock.express, {
          params: {user_connection_id: update_uc},
          user: {id: test_users[0].id},
          body: {enabled: true}
        }, mock.res(function(res) {
          expect(res.status).to.equal(200)
          expect(res.message).to.equal('user_connection record updated')
          done()
        }))
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

  describe(`${mgmt_isar_create.method.toUpperCase()} ${mgmt_isar_create.uri}`, function(done) {

    var blank_isar_document = {
      "@context": "http://schema.cnsnt.io/information_sharing_agreement",
      "@type": "InformationSharingAgreement",
      from: null,
      to: null,
      requestedResourceUris: [],
      permittedResourceUris: [],
      resolution: null,
      purpose: null,
      license: null,
      resolverSignature: null,
      dateAcknowledged: null,
      dateResolved: null,
      dateExpires: null
    }

    it('should respond with error if missing arguments', function(done) {
      mgmt_isar_create.callback.call(mock.express, {
        body: {},
        user: {id: 'foo', did: 'bar'}
      }, mock.res(function(res) {
        expect(res.error).to.equal(true)
        expect(res.status).to.equal(400)
        expect(res.message).to.equal('missing request body parameters')
        done()
      }))
    })
    
    it('should respond with error if json is not given', function(done) {
      mgmt_isar_create.callback.call(mock.express, {
        body: {document: 'foo'},
        user: {id: 'foo', did: 'bar'}
      }, mock.res(function(res) {
        expect(res.error).to.equal(true)
        expect(res.status).to.equal(400)
        expect(res.message).to.equal('expected well-formed and validatable json string')
        done()
      }))
    })

    it('should respond with error if from field is falsy', function(done) {
      var broken_doc = blank_isar_document
      
      mgmt_isar_create.callback.call(mock.express, {
        body: {document: JSON.stringify(broken_doc)},
        user: {id: 'foo', did: 'bar'}
      }, mock.res(function(res) {
        expect(res.error).to.equal(true)
        expect(res.status).to.equal(400)
        expect(res.message).to.equal('expected truthy type for from field but got undefined')
        done()
      }))
    })

    it('should respond with error if the from field doesnt match the calling agents identifier', function(done) {
      var broken_doc = blank_isar_document
      broken_doc.from = 'baz'
      mgmt_isar_create.callback.call(mock.express, {
        body: {document: JSON.stringify(broken_doc)},
        user: {id: 'foo', did: 'bar'}
      }, mock.res(function(res) {
        expect(res.error).to.equal(true)
        expect(res.status).to.equal(400)
        expect(res.message).to.equal('the from field does not match the calling agents identifier')
        done()
      }))
    })

    it('should respond with error if to field is falsy', function(done) {
      var broken_doc = blank_isar_document
      broken_doc.from = 'foo'
      
      mgmt_isar_create.callback.call(mock.express, {
        body: {document: JSON.stringify(broken_doc)},
        user: {id: 'foo', did: 'bar'}
      }, mock.res(function(res) {
        expect(res.error).to.equal(true)
        expect(res.status).to.equal(400)
        expect(res.message).to.equal('expected truthy type for to field but got undefined')
        done()
      }))
    })

    it('should respond with error if purpose field is falsy', function(done) {
      var broken_doc = blank_isar_document
      broken_doc.from = 'foo'
      
      mgmt_isar_create.callback.call(mock.express, {
        body: {document: JSON.stringify(broken_doc)},
        user: {id: 'foo', did: 'bar'}
      }, mock.res(function(res) {
        expect(res.error).to.equal(true)
        expect(res.status).to.equal(400)
        expect(res.message).to.equal('expected truthy type for to field but got undefined')
        done()
      }))
    })

    it('should respond with error if license field is falsy', function(done) {
      var broken_doc = blank_isar_document
      broken_doc.from = 'foo'
      broken_doc.purpose = 'lolz'

      mgmt_isar_create.callback.call(mock.express, {
        body: {document: JSON.stringify(broken_doc)},
        user: {id: 'foo', did: 'bar'}
      }, mock.res(function(res) {
        expect(res.error).to.equal(true)
        expect(res.status).to.equal(400)
        expect(res.message).to.equal('expected truthy type for to field but got undefined')
        done()
      }))
    })

    it('should respond with error if requestedResourceUris field is not arrayish or lengthy', function(done) {
      var broken_doc = blank_isar_document
      broken_doc.from = 'foo'
      broken_doc.to = 'bar'
      broken_doc.purpose = 'lolz'
      broken_doc.license = 'none'
      
      mgmt_isar_create.callback.call(mock.express, {
        body: {document: JSON.stringify(broken_doc)},
        user: {id: 'foo', did: 'bar'}
      }, mock.res(function(res) {
        expect(res.error).to.equal(true)
        expect(res.status).to.equal(400)
        expect(res.message).to.equal('expected lenghty arrayish type for requestedResourceUris field')
        
        broken_doc.requestedResourceUris = []
        
        mgmt_isar_create.callback.call(mock.express, {
          body: {document: JSON.stringify(broken_doc)},
          user: {id: 'foo', did: 'bar'}
        }, mock.res(function(res) {
          expect(res.error).to.equal(true)
          expect(res.status).to.equal(400)
          expect(res.message).to.equal('expected lenghty arrayish type for requestedResourceUris field')
          done()
        }))
      }))
    })

    it('should respond with error if the to user is not found', function(done) {
      var broken_doc = blank_isar_document
      broken_doc.from = 'foo'
      broken_doc.to = 'baz'
      broken_doc.purpose = 'lolz'
      broken_doc.license = 'none'
      broken_doc.requestedResourceUris = ['/resource/foo/bar']
      
      mgmt_isar_create.callback.call(mock.express, {
        body: {document: JSON.stringify(broken_doc)},
        user: {id: 'foo', did: 'bar'}
      }, mock.res(function(res) {
        expect(res.error).to.equal(true)
        expect(res.status).to.equal(404)
        expect(res.message).to.equal('user record not found')
        done()
      }))
    })

    it('should respond with error if from and to fields do not represent users with an active connection', function(done) {
      var broken_doc = blank_isar_document
      broken_doc.from = test_users[0].id
      broken_doc.to = test_users[3].id
      broken_doc.purpose = 'lolz'
      broken_doc.license = 'none'
      broken_doc.requestedResourceUris = ['/resource/foo/bar']
      
      mgmt_isar_create.callback.call(mock.express, {
        body: {document: JSON.stringify(broken_doc)},
        user: {id: test_users[0].id, did: test_users[0].id}
      }, mock.res(function(res) {
        expect(res.error).to.equal(true)
        expect(res.status).to.equal(400)
        expect(res.message).to.equal('expected an association to exist between the specified users but found none')
        done()
      }))
    })

    it('should create isar record if all arguments check out', function(done) {
      var working_doc = blank_isar_document
      working_doc.from = test_users[2].id
      working_doc.to = test_users[3].id
      working_doc.purpose = 'lolz'
      working_doc.license = 'none'
      working_doc.requestedResourceUris = ['/resource/foo/bar']
      mgmt_isar_create.callback.call(mock.express, {
        body: {document: JSON.stringify(working_doc)},
        user: {id: test_users[2].id, did: test_users[2].id}
      }, mock.res(function(res) {
        expect(res.error).to.equal(false)
        expect(res.status).to.equal(201)
        expect(res.message).to.equal('information_sharing_agreement_request record created')
        expect(typeof res.body).to.equal('object')
        expect(typeof res.body.id).to.equal('number')

        isar_respond1 = res.body.id
        
        working_doc.from = test_users[0].id
        working_doc.to = test_users[1].id
        mgmt_isar_create.callback.call(mock.express, {
          body: {document: JSON.stringify(working_doc)},
          user: {id: test_users[0].id, did: test_users[0].id}
        }, mock.res(function(res) {
          
          expect(res.error).to.equal(false)
          expect(res.status).to.equal(201)
          expect(res.message).to.equal('information_sharing_agreement_request record created')
          expect(typeof res.body).to.equal('object')
          expect(typeof res.body.id).to.equal('number')

          isar_respond2 = res.body.id
          done()
        }))
      }))
    })
  })

  describe(`${mgmt_isa_list.method.toUpperCase()} ${mgmt_isa_list.uri}`, function(done) {
    it('should respond with arrays of unacknowledged isar records, enabled isa records and disbaled isa records', function(done) {
      mgmt_isa_list.callback.call(mock.express, {
        user: {id: test_users[3].id, did: test_users[3].id}
      }, mock.res(function(res) {
        expect(res.error).to.equal(false)
        expect(res.status).to.equal(200)
        expect(res.message).to.equal('ok')
        expect(typeof res.body).to.equal('object')
        expect(
          Array.isArray(res.body.unacked) && 
          Array.isArray(res.body.enabled) && 
          Array.isArray(res.body.disabled)
        ).to.equal(true)
        expect(res.body.unacked.length).to.equal(1)
        expect(res.body.unacked[0].id).to.equal(isar_respond1)
        expect(res.body.enabled.length).to.equal(0)
        expect(res.body.disabled.length).to.equal(0)
        done()
      }))
    })
  })

  describe(`${mgmt_isar_respond.method.toUpperCase()} ${mgmt_isar_respond.uri}`, function(done) {
    
    var document, document2
    before(function(done) {
      mgmt_isa_list.callback.call(mock.express, {
        user: {id: test_users[3].id, did: test_users[3].id}
      }, mock.res(function(res) {
        if (res.error) return done(new Error('should not have been called'))
        document = JSON.parse(res.body.unacked[0].document)
        
        mgmt_isa_list.callback.call(mock.express, {
          user: {id: test_users[1].id, did: test_users[1].id}
        }, mock.res(function(res) {
          if (res.error) return done(new Error('should not have been called'))
          document2 = JSON.parse(res.body.unacked[0].document)
          done()
        }))
      }))
    })

    it('should respond with an error if missing required arguments', function(done) {
      mgmt_isar_respond.callback.call(mock.express, {
        params: {isar_id: 'foo'},
        body: {},
        user: {id: test_users[3].id, did: test_users[3].id}
      }, mock.res(function(res) {
        expect(res.error).to.equal(true)
        expect(res.status).to.equal(400)
        expect(res.message).to.equal('missing required arguments')
        done()
      }))
    })

    it('should respond with an error if the specified signing key does not exist', function(done) {
      mgmt_isar_respond.callback.call(mock.express, {
        params: {isar_id: 'foo'},
        body: {
          document: 'foo',
          signature: true,
          signing_key_alias: 'foo'
        },
        user: {
          id: test_users[3].id, 
          did: test_users[3].id,
          crypto: {alias: 'bar'}
        }
      }, mock.res(function(res) {
        expect(res.error).to.equal(true)
        expect(res.status).to.equal(404)
        expect(res.message).to.equal('crypto_key record not found')
        done()
      }))
    })

    it('should respond with an error if json is not given', function(done) {
      mgmt_isar_respond.callback.call(mock.express, {
        params: {isar_id: 'foo'},
        body: {
          document: 'foo',
          signature: true,
          signing_key_alias: 'foo'
        },
        user: {
          id: test_users[3].id, 
          did: test_users[3].id,
          crypto: {
            alias: 'foo'
          }
        }
      }, mock.res(function(res) {
        expect(res.error).to.equal(true)
        expect(res.status).to.equal(400)
        expect(res.message).to.equal('expected well-formed and validatable json string')
        done()
      }))
    })

    it('should respond with an error if a boolean is not given for the resolution field', function(done) {
      var resolved_document = document
      resolved_document.resolution = 'foo'
      mgmt_isar_respond.callback.call(mock.express, {
        params: {isar_id: 'foo'},
        body: {
          document: JSON.stringify(resolved_document),
          signature: true,
          signing_key_alias: 'foo'
        },
        user: {
          id: test_users[3].id, 
          did: test_users[3].id,
          crypto: {alias: 'foo'}
        }
      }, mock.res(function(res) {
        expect(res.error).to.equal(true)
        expect(res.status).to.equal(400)
        expect(res.message).to.equal(`expected boolean type for field resolution but got ${typeof resolved_document.resolution}`)
        done()
      }))
    })

    it('should respond with an error if a truthy resolution is given but a non lengthy and/or non arrayish type is given for the permittedresourceuris field', function(done) {
      var resolved_document = document
      resolved_document.resolution = true
      mgmt_isar_respond.callback.call(mock.express, {
        params: {isar_id: 'foo'},
        body: {
          document: JSON.stringify(resolved_document),
          signature: true,
          signing_key_alias: 'foo'
        },
        user: {
          id: test_users[3].id, 
          did: test_users[3].id,
          crypto: {alias: 'foo'}
        }
      }, mock.res(function(res) {
        expect(res.error).to.equal(true)
        expect(res.status).to.equal(400)
        expect(res.message).to.equal('expected lenghty arrayish type for permittedResourceUris field')
        
        resolved_document.permittedResourceUris = []
        mgmt_isar_respond.callback.call(mock.express, {
          params: {isar_id: 'foo'},
          body: {
            document: JSON.stringify(resolved_document),
            signature: true,
            signing_key_alias: 'foo'
          },
          user: {
            id: test_users[3].id, 
            did: test_users[3].id,
            crypto: {alias: 'foo'}
          }
        }, mock.res(function(res) {
          expect(res.error).to.equal(true)
          expect(res.status).to.equal(400)
          expect(res.message).to.equal('expected lenghty arrayish type for permittedResourceUris field')
          
          done()
        }))
      }))
    })

    it('should respond with an error if the isar record is not found', function(done) {
      var resolved_document = document
      resolved_document.resolution = true
      resolved_document.permittedResourceUris = ['/resource/foo/bar']
      mgmt_isar_respond.callback.call(mock.express, {
        params: {isar_id: 'foo'},
        body: {
          document: JSON.stringify(resolved_document),
          signature: true,
          signing_key_alias: 'foo'
        },
        user: {
          id: test_users[3].id, 
          did: test_users[3].id,
          crypto: {alias: 'foo'}
        }
      }, mock.res(function(res) {
        expect(res.error).to.equal(true)
        expect(res.status).to.equal(404)
        expect(res.message).to.equal('information_sharing_agreement_request record not found')
        done()
      }))
    })

    it('should not create an isa and isp records if resolution is falsy', function(done) {
      var resolved_document = document2
      resolved_document.resolution = false
      mgmt_isar_respond.callback.call(mock.express, {
        params: {isar_id: isar_respond2},
        body: {
          document: JSON.stringify(resolved_document),
          signature: true,
          signing_key_alias: 'foo'
        },
        user: {
          id: test_users[1].id, 
          did: test_users[1].id,
          crypto: {alias: 'foo'}
        }
      }, mock.res(function(res) {
        expect(res.error).to.equal(false)
        expect(res.status).to.equal(200)
        expect(res.message).to.equal('information_sharing_agreement_request rejected')
        done()
      }))
    })

    it('should create an isa and isp records if all checks out', function(done) {
      var resolved_document = document
      resolved_document.resolution = true
      resolved_document.permittedResourceUris = ['/resource/foo/bar']
      mgmt_isar_respond.callback.call(mock.express, {
        params: {isar_id: isar_respond1},
        body: {
          document: JSON.stringify(resolved_document),
          signature: true,
          signing_key_alias: 'foo'
        },
        user: {
          id: test_users[3].id, 
          did: test_users[3].id,
          crypto: {alias: 'foo'}
        }
      }, mock.res(function(res) {
        expect(res.error).to.equal(false)
        expect(res.status).to.equal(201)
        expect(res.message).to.equal('created information_sharing_agreement record')
        created_isa_id = res.body.id
        done()
      }))
    })
  })

  describe(`${mgmt_isa_getone.method.toUpperCase()} ${mgmt_isa_getone.uri}`, function() {

    it('should respond with an error if the isa record does not exist or does not belong to the calling agent', function(done) {
      mgmt_isa_getone.callback.call(mock.express, {
        params: {isa_id: 'foo'},
        user: {id: test_users[3].id, did: test_users[3].id}
      }, mock.res(function(res) {
        expect(res.error).to.equal(true)
        expect(res.status).to.equal(404)
        expect(res.message).to.equal('information_sharing_agreement record not found')
        
        mgmt_isa_getone.callback.call(mock.express, {
          params: {isa_id: created_isa_id},
          user: {id: test_users[0].id, did: test_users[0].id}
        }, mock.res(function(res) {
          expect(res.error).to.equal(true)
          expect(res.status).to.equal(404)
          expect(res.message).to.equal('information_sharing_agreement record not found')
          done()
        }))
      }))
    })

    it('should respond with an object describing the isa, isp and isar', function(done) {
      mgmt_isa_getone.callback.call(mock.express, {
        params: {isa_id: created_isa_id},
        user: {id: test_users[3].id, did: test_users[3].id}
      }, mock.res(function(res) {
        expect(res.error).to.equal(false)
        expect(res.status).to.equal(200)
        expect(res.message).to.equal('ok')
        expect(typeof res.body).to.equal('object')
        expect(res.body).to.have.keys([
          'information_sharing_agreement',
          'information_sharing_permissions',
          'information_sharing_agreement_request'
        ])
        done()
      }))
    })
  })

  describe(`${mgmt_isa_remove.method.toUpperCase()} ${mgmt_isa_remove.uri}`, function() {

    it('should respond with an error if the isa record does not exist', function(done) {
      mgmt_isa_remove.callback.call(mock.express, {
        params: {isa_id: 'foo'},
        user: {id: test_users[3].id, did: test_users[3].id}
      }, mock.res(function(res) {
        expect(res.error).to.equal(true)
        expect(res.status).to.equal(404)
        expect(res.message).to.equal('information_sharing_agreement record not found')
        done()
      }))
    })

    it('should set the expired bit to true if given an id that corresponds to an existing record', function(done) {
      mgmt_isa_remove.callback.call(mock.express, {
        params: {isa_id: created_isa_id},
        user: {id: test_users[3].id, did: test_users[3].id}
      }, mock.res(function(res) {
        expect(res.error).to.equal(false)
        expect(res.status).to.equal(200)
        expect(res.message).to.equal('ok')
        done()
      }))
    })
  })
})
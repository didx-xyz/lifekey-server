
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
  var mgmt_update_device = routes[1]
  var mgmt_cxn_req_create = routes[2]
  var mgmt_connection_list = routes[3]
  var mgmt_cxn_req_res = routes[4]
  var mgmt_cxn_delete = routes[5]
  var mgmt_app_activate = routes[6]
  var mgmt_isa_req_create = routes[7]
  var mgmt_isa_req_res = routes[8]
  var mgmt_isa_list = routes[9]
  var mgmt_isa_get_one = routes[10]
  var mgmt_isa_delete = routes[11]
  
  // TODO test these!
  var mgmt_isa_update = routes[13]
  var mgmt_isa_pull_from = routes[14]
  var mgmt_isa_push_to = routes[15]

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

  describe(`${mgmt_update_device.method.toUpperCase()} ${mgmt_update_device.uri}`, function() {
    
    it('should not allow the upsertion of a user_device record if required arguments are missing', function(done) {
      mgmt_update_device.callback.call(mock.express, {
        user: {id: test_users[0].id},
        body: {}
      }, mock.res(function(res) {
        expect(res.status).to.equal(400)
        expect(res.message).to.equal('missing request body parameters')
        done()
      }))
    })

    it('should allow the upsertion of a user_device record if all required arguments are given', function(done) {
      mgmt_update_device.callback.call(mock.express, {
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

  describe(`${mgmt_cxn_req_create.method.toUpperCase()} ${mgmt_cxn_req_create.uri}`, function() {
    
    it('should fail if required arguments are missing', function(done) {
      mgmt_cxn_req_create.callback.call(mock.express, {
        user: {id: test_users[0].id},
        body: {}
      }, mock.res(function(res) {
        expect(res.status).to.equal(400)
        expect(res.message).to.equal('missing request body parameters')
        done()
      }))
    })

    it('should disallow self-association', function(done) {
      mgmt_cxn_req_create.callback.call(mock.express, {
        user: {id: test_users[0].id},
        body: {target: test_users[0].id}
      }, mock.res(function(res) {
        expect(res.status).to.equal(400)
        expect(res.message).to.equal('you cannot connect to yourself')
        done()
      }))
    })

    it('should create a user connection request', function(done) {
      mgmt_cxn_req_create.callback.call(mock.express, {
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

    // TODO add test case for duplicate connection requests
    // TOOD add test case for sending connection request when connection is already established
    
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
        done()
      }))
    })
  })

  describe(`${mgmt_cxn_req_res.method.toUpperCase()} ${mgmt_cxn_req_res.uri}`, function() {

    it('should fail if required arguments are missing', function(done) {
      mgmt_cxn_req_res.callback.call(mock.express, {
        params: {user_connection_request_id: respondid},
        user: {id: test_users[1].id},
        body: {}
      }, mock.res(function(res) {
        expect(res.status).to.equal(400)
        expect(res.message).to.equal('missing request body parameters')
        done()
      }))
    })

    it('should 201 if the connection was created', function(done) {
      mgmt_cxn_req_res.callback.call(mock.express, {
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

    // TODO test case: should return not found if the user is not associated to the record
  })

  describe(`${mgmt_cxn_delete.method.toUpperCase()} ${mgmt_cxn_delete.uri}`, function() {
    it('should return not found if the user is not associated to the record', function(done) {
      mgmt_cxn_delete.callback.call(mock.express, {
        params: {user_connection_id: update_uc},
        user: {id: Number.MAX_VALUE}
      }, mock.res(function(res) {
        expect(res.status).to.equal(404)
        expect(res.message).to.equal('user_connection record not found')
        done()
      }))
    })

    it('should delete the connection record if the caller is associated with the record', function(done) {
      mgmt_cxn_delete.callback.call(mock.express, {
        params: {user_connection_id: update_uc},
        user: {id: test_users[1].id}
      }, mock.res(function(res) {
        expect(res.status).to.equal(200)
        expect(res.message).to.equal('user_connection record deleted')
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

  describe(`${mgmt_isa_req_create.method.toUpperCase()} ${mgmt_isa_req_create.uri}`, function() {

    before(function(done) {
      mgmt_cxn_req_create.callback.call(mock.express, {
        user: {id: test_users[2].id},
        body: {target: test_users[3].id}
      }, mock.res(function(res) {
        expect(res.status).to.equal(201)
        expect(typeof res.body).to.equal('object')
        expect(typeof res.body.id).to.equal('number')
        expect(res.message).to.equal('user_connection_request record created')
        
        mgmt_cxn_req_res.callback.call(mock.express, {
          params: {user_connection_request_id: res.body.id},
          user: {id: test_users[3].id},
          body: {accepted: true}
        }, mock.res(function(res) {
          expect(res.status).to.equal(201)
          expect(res.message).to.equal('user_connection created')
          expect(typeof res.body).to.equal('object')
          expect(typeof res.body.id).to.equal('number')
          
          mgmt_cxn_req_create.callback.call(mock.express, {
            user: {id: test_users[0].id},
            body: {target: test_users[1].id}
          }, mock.res(function(res) {
            expect(res.status).to.equal(201)
            expect(typeof res.body).to.equal('object')
            expect(typeof res.body.id).to.equal('number')
            expect(res.message).to.equal('user_connection_request record created')
            
            mgmt_cxn_req_res.callback.call(mock.express, {
              params: {user_connection_request_id: res.body.id},
              user: {id: test_users[1].id},
              body: {accepted: true}
            }, mock.res(function(res) {
              expect(res.status).to.equal(201)
              expect(res.message).to.equal('user_connection created')
              expect(typeof res.body).to.equal('object')
              expect(typeof res.body.id).to.equal('number')
              
              done()
            }))
          }))
        }))
      }))
    })

    it('should respond with error if missing arguments', function(done) {
      mgmt_isa_req_create.callback.call(mock.express, {
        body: {},
        user: {id: 'foo', did: 'bar'}
      }, mock.res(function(res) {
        expect(res.error).to.equal(true)
        expect(res.status).to.equal(400)
        expect(res.message).to.equal('missing request body parameters')
        done()
      }))
    })

    it('should respond with error if requested_schemas field is not arrayish or lengthy', function(done) {
      mgmt_isa_req_create.callback.call(mock.express, {
        body: {
          to: 'bar',
          purpose:'lolz',
          license: 'none'
        },
        user: {id: 'foo', did: 'bar'}
      }, mock.res(function(res) {
        expect(res.error).to.equal(true)
        expect(res.status).to.equal(400)
        expect(res.message).to.equal('expected lengthy arrayish type for requested_schemas field')
        
        mgmt_isa_req_create.callback.call(mock.express, {
          body: {
            to: 'bar',
            purpose:'lolz',
            license: 'none',
            requested_schemas: []
          },
          user: {id: 'foo', did: 'bar'}
        }, mock.res(function(res) {
          expect(res.error).to.equal(true)
          expect(res.status).to.equal(400)
          expect(res.message).to.equal('expected lengthy arrayish type for requested_schemas field')
          done()
        }))
      }))
    })

    it('should respond with error if the to user is not found', function(done) {
      mgmt_isa_req_create.callback.call(mock.express, {
        body: {
          to: 'baz',
          purpose: 'lolz',
          license: 'none',
          requested_schemas: ['/resource/foo/bar']
        },
        user: {id: 'foo', did: 'bar'}
      }, mock.res(function(res) {
        expect(res.error).to.equal(true)
        expect(res.status).to.equal(404)
        expect(res.message).to.equal('user record not found')
        done()
      }))
    })

    it('should respond with error if the calling agent and the to-user do not have an active connection', function(done) {
      mgmt_isa_req_create.callback.call(mock.express, {
        body: {
          to: test_users[3].id,
          purpose: 'lolz',
          license: 'none',
          requested_schemas: ['/resource/foo/bar']
        },
        user: {id: test_users[0].id, did: test_users[0].id}
      }, mock.res(function(res) {
        expect(res.error).to.equal(true)
        expect(res.status).to.equal(400)
        expect(res.message).to.equal('user_connection record not found')
        done()
      }))
    })

    it('should create isar record if all arguments check out', function(done) {
      mgmt_isa_req_create.callback.call(mock.express, {
        body: {
          to: test_users[3].id,
          purpose: 'lolz',
          license: 'none',
          requested_schemas: ['/resource/foo/bar']
        },
        user: {id: test_users[2].id}
      }, mock.res(function(res) {
        expect(res.error).to.equal(false)
        expect(res.status).to.equal(201)
        expect(res.message).to.equal('information_sharing_agreement_request record created')
        expect(typeof res.body).to.equal('object')
        expect(typeof res.body.id).to.equal('number')

        isar_respond1 = res.body.id
        
        mgmt_isa_req_create.callback.call(mock.express, {
          body: {
            to: test_users[1].id,
            purpose: 'lolz',
            license: 'none',
            requested_schemas: ['/resource/foo/bar']
          },
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

  describe(`${mgmt_isa_req_res.method.toUpperCase()} ${mgmt_isa_req_res.uri}`, function() {
    
    var requested1, requested2
    before(function(done) {
      mgmt_isa_list.callback.call(mock.express, {
        user: {id: test_users[3].id, did: test_users[3].id}
      }, mock.res(function(res) {
        if (res.error) return done(new Error('should not have been called'))
        requested1 = res.body.unacked[0].requested_schemas
        
        mgmt_isa_list.callback.call(mock.express, {
          user: {id: test_users[1].id, did: test_users[1].id}
        }, mock.res(function(res) {
          if (res.error) return done(new Error('should not have been called'))
          requested2 = res.body.unacked[0].requested_schemas
          done()
        }))
      }))
    })

    it('should respond with an error if a boolean is not given for the accepted field', function(done) {
      mgmt_isa_req_res.callback.call(mock.express, {
        params: {isar_id: 'foo'},
        body: {accepted: 'foo'},
        user: {
          id: test_users[3].id, 
          did: test_users[3].id
        }
      }, mock.res(function(res) {
        expect(res.error).to.equal(true)
        expect(res.status).to.equal(400)
        expect(res.message).to.equal('expected boolean type for accepted field')
        done()
      }))
    })

    it('should respond with an error if a truthy accepted is given but a non lengthy and/or non arrayish type is given for the permitted_resources field', function(done) {
      mgmt_isa_req_res.callback.call(mock.express, {
        params: {isar_id: 'foo'},
        body: {
          accepted: true,
          permitted_resources: []
        },
        user: {
          id: test_users[3].id, 
          did: test_users[3].id
        }
      }, mock.res(function(res) {
        expect(res.error).to.equal(true)
        expect(res.status).to.equal(400)
        expect(res.message).to.equal('expected lengthy arrayish type for permitted_resources field')
        done()
      }))
    })

    it('should respond with an error if the isar record is not found', function(done) {
      mgmt_isa_req_res.callback.call(mock.express, {
        params: {isar_id: 'foo'},
        body: {accepted: false},
        user: {
          id: test_users[3].id,
          did: test_users[3].id
        }
      }, mock.res(function(res) {
        expect(res.error).to.equal(true)
        expect(res.status).to.equal(404)
        expect(res.message).to.equal('information_sharing_agreement_request record not found')
        done()
      }))
    })

    it('should not create an isa and isp records if accepted is falsy', function(done) {
      mgmt_isa_req_res.callback.call(mock.express, {
        params: {isar_id: isar_respond2},
        body: {accepted: false},
        user: {
          id: test_users[1].id,
          did: test_users[1].id
        }
      }, mock.res(function(res) {
        expect(res.error).to.equal(false)
        expect(res.status).to.equal(200)
        expect(res.message).to.equal('information_sharing_agreement_request rejected')
        done()
      }))
    })

    it('should create an isa and isp records if all checks out', function(done) {
      mgmt_isa_req_res.callback.call(mock.express, {
        params: {isar_id: isar_respond1},
        body: {
          accepted: true,
          permitted_resources: [
            {id: 1, schema: 'foo'}
          ]
        },
        user: {
          id: test_users[3].id,
          did: test_users[3].id
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

  describe(`${mgmt_isa_get_one.method.toUpperCase()} ${mgmt_isa_get_one.uri}`, function() {

    it('should respond with an error if the isa record does not exist or does not belong to the calling agent', function(done) {
      
      mgmt_isa_get_one.callback.call(mock.express, {
        params: {isa_id: created_isa_id},
        user: {id: test_users[0].id, did: test_users[0].id}
      }, mock.res(function(res) {
        expect(res.error).to.equal(true)
        expect(res.status).to.equal(404)
        expect(res.message).to.equal('information_sharing_agreement record not found')
        done()
      }))
    })

    it('should respond with an object describing the isa, isp and isar', function(done) {
      mgmt_isa_get_one.callback.call(mock.express, {
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

  describe(`${mgmt_isa_delete.method.toUpperCase()} ${mgmt_isa_delete.uri}`, function() {

    it('should respond with an error if the isa record does not exist', function(done) {
      mgmt_isa_delete.callback.call(mock.express, {
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
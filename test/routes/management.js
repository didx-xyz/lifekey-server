
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
var actions_receipts_isa_id
var action_delete_id
var isar_respond1, isar_respond2
var created_isa_id
var face_verify_token
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
  },
  {
    email: `u_5${now}@example.com`,
    nickname: `u_5${now}`,
    device_id: `u_5${now}`,
    device_platform: 'ios',
    public_key_algorithm: 'rsa',
    public_key: '',
    plaintext_proof: `u_5${now}`,
    signable_proof: crypto.createHash('sha256').update(`u_5${now}`).digest(),
    signed_proof: '',
    fingerprint: {
      public_key_algorithm: 'rsa',
      public_key: '',
      signable_proof: crypto.createHash('sha256').update(`u_5${now}`).digest(),
      plaintext_proof: `u_5${now}`,
      signed_proof: ''
    }
  },
  {
    email: `u_6${now}@example.com`,
    nickname: `u_5${now}`,
    device_id: `u_6${now}`,
    device_platform: 'ios',
    public_key_algorithm: 'rsa',
    public_key: '',
    plaintext_proof: `u_6${now}`,
    signable_proof: crypto.createHash('sha256').update(`u_6${now}`).digest(),
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
    email: `u_8${now}@example.com`,
    nickname: `u_8${now}`,
    device_id: `u_8${now}`,
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
  },

  // mgmt_register - no email
  {
    email: 'foofa',
    nickname: `u_5${now}`,
    webhook_url: 'http://example.com/abc123' + now,
    public_key_algorithm: 'rsa',
    public_key: 'qux',
    plaintext_proof: 'qux',
    signable_proof: crypto.createHash('sha256').update(`foofa_1${now}`).digest(),
    signed_proof: 'qux'
  },

  // mgmt_register - no string for webhook_url
  {
    email: `u_6${now}@example.com`,
    nickname: `u_6${now}`,
    webhook_url: 1234,
    public_key_algorithm: 'rsa',
    public_key: 'qux',
    plaintext_proof: 'qux',
    signable_proof: crypto.createHash('sha256').update(`u_6${now}`).digest(),
    signed_proof: 'qux'
  },

  // mgmt_register - no url given for webhook_url
  {
    email: `u_7${now}@example.com`,
    nickname: `u_7${now}`,
    webhook_url: 'i hope this isnt a real url',
    public_key_algorithm: 'rsa',
    public_key: 'qux',
    plaintext_proof: 'qux',
    signable_proof: crypto.createHash('sha256').update(`u_7${now}`).digest(),
    signed_proof: 'qux'
  },

  // mgmt_register - missing fingerprint args
  {
    email: `u_8${now}@example.com`,
    nickname: `u_8${now}`,
    device_id: `u_8${now}`,
    device_platform: 'ios',
    public_key_algorithm: 'rsa',
    public_key: 'qux',
    plaintext_proof: 'qux',
    signable_proof: crypto.createHash('sha256').update(`u_8${now}`).digest(),
    signed_proof: 'qux',
    fingerprint: {}
  },
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
    mock.express.set('db_errors', database.errors)
    console.log('✓ initialised database models')
    return Promise.resolve()
  }).then(function() {
    test_users[0].private_key = crypto.randomBytes(32)
    test_users[1].private_key = crypto.randomBytes(32)
    test_users[2].private_key = rsa.generatePrivateKey()
    test_users[3].private_key = rsa.generatePrivateKey()
    test_users[4].private_key = rsa.generatePrivateKey()
    test_users[4].fingerprint.private_key = rsa.generatePrivateKey()
    test_users[5].private_key = rsa.generatePrivateKey()
    test_users_fail_cases[3].private_key = rsa.generatePrivateKey()
    console.log('✓ generated private keys')
    return Promise.resolve()
  }).then(function() {
    return Promise.all([
      ec.getPublic(test_users[0].private_key),
      ec.getPublic(test_users[1].private_key),
      test_users[2].private_key.toPublicPem().toString('utf8'),
      test_users[3].private_key.toPublicPem().toString('utf8'),
      test_users[4].private_key.toPublicPem().toString('utf8'),
      test_users[4].fingerprint.private_key.toPublicPem().toString('utf8'),
      test_users[5].private_key.toPublicPem().toString('utf8'),
      test_users_fail_cases[3].private_key.toPublicPem().toString('utf8')
    ])
  }).then(function(public_keys) {
    console.log('✓ calculated public keys')
    test_users[0].public_key = public_keys[0].toString('base64')
    test_users[1].public_key = public_keys[1].toString('base64')
    test_users[2].public_key = public_keys[2]
    test_users[3].public_key = public_keys[3]
    test_users[4].public_key = public_keys[4]
    test_users[4].fingerprint.public_key = public_keys[5]
    test_users[5].public_key = public_keys[6]
    test_users_fail_cases[3].public_key = public_keys[7]
    console.log('✓ base64ified public keys')
    return Promise.resolve()
  }).then(function() {
    return Promise.all([
      ec.sign(test_users[0].private_key, test_users[0].signable_proof),
      ec.sign(test_users[1].private_key, test_users[1].signable_proof),
      test_users[2].private_key.hashAndSign('sha256', test_users[2].plaintext_proof, 'utf8', 'base64', false),
      test_users[3].private_key.hashAndSign('sha256', test_users[3].plaintext_proof, 'utf8', 'base64', false),
      test_users[4].private_key.hashAndSign('sha256', test_users[4].plaintext_proof, 'utf8', 'base64', false),
      test_users[4].fingerprint.private_key.hashAndSign('sha256', test_users[4].fingerprint.plaintext_proof, 'utf8', 'base64', false),
      test_users[5].private_key.hashAndSign('sha256', test_users[5].plaintext_proof, 'utf8', 'base64', false),
      test_users_fail_cases[3].private_key.hashAndSign('sha256', test_users_fail_cases[3].plaintext_proof, 'utf8', 'base64', false)
    ])
  }).then(function(signatures) {
    console.log('✓ signed initial key proofs')
    test_users[0].signed_proof = signatures[0].toString('base64')
    test_users[1].signed_proof = signatures[1].toString('base64')
    test_users[2].signed_proof = signatures[2]
    test_users[3].signed_proof = signatures[3]
    test_users[4].signed_proof = signatures[4]
    test_users[4].fingerprint.signed_proof = signatures[5]
    test_users[5].signed_proof = signatures[6]
    test_users_fail_cases[3].signed_proof = signatures[7]
    console.log('✓ base64ified signed proofs')
    return Promise.resolve()
  }).then(function() {
    test_users[0].signable_proof = test_users[0].signable_proof.toString('hex')
    test_users[1].signable_proof = test_users[1].signable_proof.toString('hex')
    test_users[2].signable_proof = test_users[2].signable_proof.toString('hex')
    test_users[3].signable_proof = test_users[3].signable_proof.toString('hex')
    test_users[4].signable_proof = test_users[4].signable_proof.toString('hex')
    test_users[4].fingerprint.signable_proof = test_users[4].fingerprint.signable_proof.toString('hex')
    test_users[5].signable_proof = test_users[5].signable_proof.toString('hex')
    test_users_fail_cases[3].signable_proof = test_users_fail_cases[3].signable_proof.toString('hex')
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
  var resource_create = require('../../src/routes/resource')[2]
  var mgmt_isa_update = routes[13]
  var mgmt_isa_pull_from = routes[14]
  var mgmt_isa_push_to = routes[15]
  var mgmt_thanks_balance_get = routes[16]
  var mgmt_key_create = routes[17]
  var mgmt_key_get = routes[18]
  var mgmt_action_create = routes[19]
  var mgmt_action_user_get_all = routes[28]
  var mgmt_action_get_all = routes[20]
  var mgmt_action_get_one = routes[21]
  var mgmt_isa_by_action = routes[22]
  var mgmt_isa_receipt = routes[23]
  var mgmt_action_delete = routes[24]
  var mgmt_face_verify_create = routes[25]
  var mgmt_face_verify_get = routes[26]
  var mgmt_face_verify_respond = routes[27]

  var mgmt_send_thanks = routes[29]

  var mgmt_message = routes[30]

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
            
            var user = mock.express.get('models').user
            Promise.all([
              test_users[0].id,
              test_users[1].id,
              test_users[2].id,
              test_users[3].id,
              test_users[4].id
            ].map(function(id) {
              return user.update({did: id}, {where: {id: id}})
            })).then(done.bind(done, null)).catch(done)
          }))
        }))
      }))
    })
    
    describe('-- failure cases --', function() {
      
      it('should fail if required parameters are missing', function(done) {
        mgmt_register.callback.call(mock.express, {
          body: {}
        }, mock.res(function(res) {
          expect(res.status).to.equal(400)
          expect(res.message).to.equal('missing request body parameters')
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
      
      it('should fail if an attempting to create a user without an email address', function(done) {
        mgmt_register.callback.call(mock.express, {
          body: test_users_fail_cases[3]
        }, mock.res(function(res) {
          expect(res.status).to.equal(400)
          expect(res.message).to.equal('validation error')
          done()
        }))
      })

      it('should fail if attempting to create a user without a device id and an invalid webhook address', function(done) {
        mgmt_register.callback.call(mock.express, {
          body: test_users_fail_cases[4]
        }, mock.res(function(res) {
          expect(res.status).to.equal(400)
          expect(res.message).to.equal('expected string type for webhook_url')
          
          mgmt_register.callback.call(mock.express, {
            body: test_users_fail_cases[5]
          }, mock.res(function(res) {
            expect(res.status).to.equal(400)
            expect(res.message).to.equal('url not given for webhook_url')
            done()
          }))
        }))
      })

      it('should fail if missing required fingerprint args', function(done) {
        mgmt_register.callback.call(mock.express, {
          body: test_users_fail_cases[6]
        }, mock.res(function(res) {
          expect(res.status).to.equal(400)
          expect(res.message).to.equal('missing required fingerprint arguments')
          done()
        }))
      })
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

    it('should allow duplicate usernames', function(done) {
      mgmt_register.callback.call(mock.express, {
        body: test_users[5]
      }, mock.res(function(res) {
        expect(res.status).to.equal(201)
        expect(typeof res.body).to.equal('object')
        expect(typeof res.body.id).to.equal('number')
        test_users[5].id = res.body.id
        done()
      }))
    })

    it('should insert a new user record if using fingerprint signing parameters and respond with a basic identifier', function(done) {
      mgmt_register.callback.call(mock.express, {
        body: test_users[4]
      }, mock.res(function(res) {
        expect(res.status).to.equal(201)
        expect(typeof res.body).to.equal('object')
        expect(typeof res.body.id).to.equal('number')
        test_users[4].id = res.body.id
        done()
      }))
    })
  })

  describe(`${mgmt_update_device.method.toUpperCase()} ${mgmt_update_device.uri}`, function() {
    
    it('should not allow the update of a hook record if required arguments are missing', function(done) {
      mgmt_update_device.callback.call(mock.express, {
        user: {id: test_users[0].id},
        body: {}
      }, mock.res(function(res) {
        expect(res.status).to.equal(400)
        expect(res.message).to.equal('missing request body parameters')
        done()
      }))
    })

    it('should allow the update of a webhook url if all required arguments are given', function(done) {
      mgmt_update_device.callback.call(mock.express, {
        user: {id: test_users[0].id},
        body: {webhook_url: 'http://example.com/myhook' + Date.now()}
      }, mock.res(function(res) {
        expect(res.status).to.equal(200)
        expect(res.message).to.equal('updated')
        done()
      }))
    })

    it('should allow the update of a user_device record if all required arguments are given', function(done) {
      mgmt_update_device.callback.call(mock.express, {
        user: {id: test_users[0].id},
        body: {
          device_id: Date.now() + 'abc1232342asd',
          device_platform: 'ios'
        }
      }, mock.res(function(res) {
        expect(res.status).to.equal(200)
        expect(res.message).to.equal('updated')
        done()
      }))
    })
  })

  describe(`${mgmt_cxn_req_create.method.toUpperCase()} ${mgmt_cxn_req_create.uri}`, function() {

    before(function(done) {
      // set up for final case in suite
      mock.express.get(
        'models'
      ).user_connection.create({
        to_did: test_users[3].id,
        from_did: test_users[2].id,
        enabled: true
      }).then(done.bind(done, null)).catch(done)
    })
    
    it('should fail if required arguments are missing', function(done) {
      mgmt_cxn_req_create.callback.call(mock.express, {
        user: {did: test_users[0].id},
        body: {}
      }, mock.res(function(res) {
        expect(res.status).to.equal(400)
        expect(res.message).to.equal('missing request body parameters')
        done()
      }))
    })

    it('should disallow self-association', function(done) {
      mgmt_cxn_req_create.callback.call(mock.express, {
        user: {did: test_users[0].id},
        body: {target: test_users[0].id}
      }, mock.res(function(res) {
        expect(res.status).to.equal(400)
        expect(res.message).to.equal('you cannot connect to yourself')
        done()
      }))
    })

    it('should create a user connection request', function(done) {
      mgmt_cxn_req_create.callback.call(mock.express, {
        user: {did: test_users[0].id},
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

    it('should disallow the creation of duplicate connection requests', function(done) {
      mgmt_cxn_req_create.callback.call(mock.express, {
        user: {did: test_users[0].id},
        body: {target: test_users[1].id}
      }, mock.res(function(res) {
        expect(res.error).to.equal(true)
        expect(res.status).to.equal(400)
        expect(res.message).to.equal('user_connection_request record already exists')
        expect(res.body).to.equal(null)
        done()
      }))
    })

    it('should disallow the creation of a connection request when an established connection already exists', function(done) {
      mgmt_cxn_req_create.callback.call(mock.express, {
        user: {did: test_users[2].id},
        body: {target: test_users[3].id}
      }, mock.res(function(res) {
        expect(res.error).to.equal(true)
        expect(res.status).to.equal(400)
        expect(res.message).to.equal('user_connection record already exists')
        expect(res.body).to.equal(null)
        done()
      }))
    })
  })

  describe(`${mgmt_connection_list.method.toUpperCase()} ${mgmt_connection_list.uri}`, function() {
    it('should return arrays of unacknowledged connection requests and enabled connections', function(done) {
      mgmt_connection_list.callback.call(mock.express, {
        user: {did: test_users[1].id}
      }, mock.res(function(res) {
        expect(res.status).to.equal(200)
        expect(Array.isArray(res.body.unacked)).to.be.ok
        expect(res.body.unacked.length).to.equal(1)
        expect(res.body.unacked[0]).to.equal(respondid)
        expect(Array.isArray(res.body.enabled)).to.be.ok
        expect(res.body.enabled.length).to.equal(0)
        done()
      }))
    })
  })

  describe(`${mgmt_cxn_req_res.method.toUpperCase()} ${mgmt_cxn_req_res.uri}`, function() {

    before(function(done) {
      // add action urls for these two
      var now = Date.now()
      mock.express.models.user.update({
        actions_url: 'http://example.com/foo' + now
      }, {
        where: {id: test_users[0].id}
      }).then(done.bind(done, null)).catch(done)
    })

    it('should fail if required arguments are missing', function(done) {
      mgmt_cxn_req_res.callback.call(mock.express, {
        params: {user_connection_request_id: respondid},
        user: {did: test_users[1].id},
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
        user: {
          did: test_users[1].id,
          actions_url: 'http://example.com/foo_' + Date.now()
        },
        body: {accepted: true}
      }, mock.res(function(res) {
        
        // assert that the acceptance was successful
        expect(res.status).to.equal(201)
        expect(res.message).to.equal('user_connection created')
        expect(typeof res.body).to.equal('object')
        expect(typeof res.body.id).to.equal('number')

        // ensure mock contains call data with actions url
        var call_data = process.get_call_data().call_args
        
        expect(
          !!(
            call_data[
              Object.keys(call_data).length
            ].notification_request.data.actions_url
          )
        ).to.equal(true)

        update_uc = res.body.id

        // enumerate list of connections again to assert correct
        mgmt_connection_list.callback.call(mock.express, {
          user: {did: test_users[1].id}
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
        user: {did: Number.MAX_VALUE}
      }, mock.res(function(res) {
        expect(res.status).to.equal(404)
        expect(res.message).to.equal('user_connection record not found')
        done()
      }))
    })

    it('should delete the connection record if the caller is associated with the record', function(done) {
      mgmt_cxn_delete.callback.call(mock.express, {
        params: {user_connection_id: update_uc},
        user: {did: test_users[1].id}
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

    it('should update the app_activation_link_clicked bit to enabled if not yet enabled, send a signal to generate a vc for email address and respond with html string', function(done) {
      mgmt_app_activate.callback.call(mock.express, {
        params: {activation_code: activation_code}
      }, mock.res(function(res) {
        var cd = process.get_call_data()
        var last_send = cd.call_args[cd.call_count]
        expect('vc_generation_request' in last_send).to.equal(true)
        expect(last_send.vc_generation_request.field).to.equal('email')
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
        user: {did: test_users[0].id},
        body: {target: test_users[1].id}
      }, mock.res(function(res) {
        if (res.status !== 201) return done(`should not have been called ${res.status}`)
        
        mgmt_cxn_req_res.callback.call(mock.express, {
          params: {user_connection_request_id: res.body.id},
          user: {did: test_users[1].id},
          body: {accepted: true}
        }, mock.res(function(res) {
          if (res.status !== 201) return done(`should not have been called ${res.status}`)
          
          done()
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

    it('should respond with error if required_entities field is not arrayish or lengthy', function(done) {
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
        expect(res.message).to.equal('expected lengthy arrayish type for required_entities field')
        
        mgmt_isa_req_create.callback.call(mock.express, {
          body: {
            to: 'bar',
            purpose:'lolz',
            license: 'none',
            required_entities: []
          },
          user: {id: 'foo', did: 'bar'}
        }, mock.res(function(res) {
          expect(res.error).to.equal(true)
          expect(res.status).to.equal(400)
          expect(res.message).to.equal('expected lengthy arrayish type for required_entities field')
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
          required_entities: ['/resource/foo/bar']
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
          required_entities: ['/resource/foo/bar']
        },
        user: {did: test_users[0].id}
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
          required_entities: ['/resource/foo/bar']
        },
        user: {did: test_users[2].id}
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
            required_entities: ['/resource/foo/bar']
          },
          user: {did: test_users[0].id}
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
        user: {did: test_users[3].id}
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
        user: {did: test_users[3].id}
      }, mock.res(function(res) {
        if (res.error) return done(new Error('should not have been called'))
        requested1 = res.body.unacked[0].required_entities
        
        mgmt_isa_list.callback.call(mock.express, {
          user: {did: test_users[1].id}
        }, mock.res(function(res) {
          if (res.error) return done(new Error('should not have been called'))
          requested2 = res.body.unacked[0].required_entities
          done()
        }))
      }))
    })

    it('should respond with an error if a boolean is not given for the accepted field', function(done) {
      mgmt_isa_req_res.callback.call(mock.express, {
        params: {isar_id: 'foo'},
        body: {accepted: 'foo'},
        user: {
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
            {id: 10e2, schema: 'foo'}
          ]
        },
        user: {
          did: test_users[3].id
        }
      }, mock.res(function(res) {
        expect(res.error).to.equal(false)
        expect(res.status).to.equal(201)
        expect(res.message).to.equal('created information_sharing_agreement record')
        created_isa_id = res.body.id
        var cd = process.get_call_data()
        var msg = cd.call_args[cd.call_count - 1].isa_ledger_request
        expect(msg.isa_id).to.equal(created_isa_id)
        done()
      }))
    })
  })

  describe(`${mgmt_isa_get_one.method.toUpperCase()} ${mgmt_isa_get_one.uri}`, function() {

    it('should respond with an error if the isa record does not exist or does not belong to the calling agent', function(done) {
      
      mgmt_isa_get_one.callback.call(mock.express, {
        params: {isa_id: created_isa_id},
        user: {did: test_users[0].id}
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
        user: {did: test_users[3].id}
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

    // TODO cover error branches

    it('should respond with an error if the isa record does not exist', function(done) {
      mgmt_isa_delete.callback.call(mock.express, {
        params: {isa_id: created_isa_id},
        user: {did: test_users[3].id}
      }, mock.res(function(res) {
        expect(res.error).to.equal(false)
        expect(res.status).to.equal(200)
        expect(res.message).to.equal('ok')
        done()
      }))
    })
  })

  describe(`${mgmt_isa_update.method.toUpperCase()} ${mgmt_isa_update.uri}`, function() {

    var expired_isa = created_isa_id
    var created_isa
    before(function(done) {
      mgmt_isa_req_create.callback.call(mock.express, {
        user: {did: test_users[2].id},
        body: {
          to: test_users[3].id,
          purpose: 'lolz',
          license: 'none',
          required_entities: ['/resource/foo/bar']
        }
      }, mock.res(function(res) {
        expect(typeof res.body.id).to.equal('number')

        mgmt_isa_req_res.callback.call(mock.express, {
          user: {did: test_users[3].id},
          params: {isar_id: res.body.id},
          body: {
            accepted: true,
            permitted_resources: [
              {id: 10e2, schema: 'bar'}
            ]
          }
        }, mock.res(function(res) {
          expect(typeof res.body.id).to.equal('number')
          
          created_isa = res.body.id
          done()
        }))
      }))
    })

    it('should respond with an error if permitted_resources array is not given', function(done) {
      mgmt_isa_update.callback.call(mock.express, {
        user: {did: test_users[3].id},
        params: {isa_id: 'foo'},
        body: {}
      }, mock.res(function(res) {
        expect(res.error).to.equal(true)
        expect(res.status).to.equal(400)
        expect(res.message).to.equal('expected lengthy arrayish type for permitted_resources field')
        
        mgmt_isa_update.callback.call(mock.express, {
          user: {did: test_users[3].id},
          params: {isa_id: 'foo'},
          body: {permitted_resources: []}
        }, mock.res(function(res) {
          expect(res.error).to.equal(true)
          expect(res.status).to.equal(400)
          expect(res.message).to.equal('expected lengthy arrayish type for permitted_resources field')
          done()
        }))
      }))
    })

    it('should respond with an error if the specified isa record is not found or the calling user is not associated with the record', function(done) {
      mgmt_isa_update.callback.call(mock.express, {
        user: {did: test_users[3].id},
        params: {isa_id: Number.MAX_VALUE},
        body: {
          permitted_resources: [
            {id: 10e2, schema: 'bar'}
          ]
        }
      }, mock.res(function(res) {
        expect(res.error).to.equal(true)
        expect(res.status).to.equal(404)
        expect(res.message).to.equal('information_sharing_agreement record not found')
        done()
      }))
    })

    // it('should respond with an error if the specified isa record has expired', function(done) {
    //   mgmt_isa_update.callback.call(mock.express, {
    //     user: {id: test_users[3].id},
    //     params: {isa_id: expired_isa},
    //     body: {
    //       permitted_resources: [
    //         {id: 10e2, schema: 'bar'}
    //       ]
    //     }
    //   }, mock.res(function(res) {
    //     expect(res.error).to.equal(true)
    //     expect(res.status).to.equal(400)
    //     expect(res.message).to.equal('information_sharing_agreement record has expired')
    //     done()
    //   }))
    // })

    it('should destroy and recreated the isp records associated with the specified isa record', function(done) {
      mgmt_isa_update.callback.call(mock.express, {
        user: {did: ''+test_users[3].id},
        params: {isa_id: created_isa},
        body: {
          permitted_resources: [
            {id: 10e2, schema: 'bar'}
          ]
        }
      }, mock.res(function(res) {
        expect(res.error).to.equal(false)
        expect(res.status).to.equal(200)
        expect(res.message).to.equal('information_sharing_permission records updated')
        done()
      }))
    })
  })

  describe(`${mgmt_isa_pull_from.method.toUpperCase()} ${mgmt_isa_pull_from.uri}`, function() {
    
    var created_resource
    var expired_isa_2
    var expired_isa = created_isa_id
    var created_isa
    before(function(done) {
      
      mgmt_isa_req_create.callback.call(mock.express, {
        user: {did: test_users[2].id},
        body: {
          to: test_users[3].id,
          purpose: 'lolz',
          license: 'none',
          required_entities: ['/resource/foo/bar']
        }
      }, mock.res(function(res) {
        expect(typeof res.body.id).to.equal('number')

        var isar_id = res.body.id
        resource_create.callback.call(mock.express, {
          user: {id: test_users[3].id},
          body: {
            entity: 'foo',
            attribute: 'bar',
            alias: 'bazqux',
            value: 'foo bar'
          }
        }, mock.res(function(res) {
          expect(res.error).to.equal(false)

          created_resource = res.body.id

          mgmt_isa_req_res.callback.call(mock.express, {
            user: {did: test_users[3].id},
            params: {isar_id: isar_id},
            body: {
              accepted: true,
              permitted_resources: [
                {id: created_resource, schema: 'bar'}
              ]
            }
          }, mock.res(function(res) {
            expect(typeof res.body.id).to.equal('number')
            
            created_isa = res.body.id
            
            mgmt_isa_req_create.callback.call(mock.express, {
              user: {did: test_users[2].id},
              body: {
                to: test_users[3].id,
                purpose: 'lolz',
                license: 'none',
                required_entities: ['/resource/foo/bar']
              }
            }, mock.res(function(res) {
              expect(typeof res.body.id).to.equal('number')

              mgmt_isa_req_res.callback.call(mock.express, {
                user: {did: test_users[3].id},
                params: {isar_id: res.body.id},
                body: {
                  accepted: true,
                  permitted_resources: [
                    {id: created_resource, schema: 'bar'}
                  ]
                }
              }, mock.res(function(res) {
                expect(typeof res.body.id).to.equal('number')
                
                expired_isa_2 = res.body.id
                mgmt_isa_delete.callback.call(mock.express, {
                  params: {isa_id: res.body.id},
                  user: {did: test_users[3].id}
                }, mock.res(function(res) {
                  expect(res.error).to.equal(false)
                  expect(res.status).to.equal(200)
                  expect(res.message).to.equal('ok')
                  done()
                }))
              }))
            }))
          }))
        }))
      }))
    })

    it('should respond with an error if the specified isa record is not found or the calling user is not associated with the record', function(done) {
      mgmt_isa_pull_from.callback.call(mock.express, {
        user: {did: test_users[0].id},
        params: {isa_id: 10e2}
      }, mock.res(function(res) {
        expect(res.error).to.equal(true)
        expect(res.status).to.equal(404)
        expect(res.message).to.equal('information_sharing_agreement record not found')
        done()
      }))
    })

    // it('should respond with an error if the specified isa record has expired', function(done) {
    //   mgmt_isa_pull_from.callback.call(mock.express, {
    //     user: {id: test_users[3].id},
    //     params: {isa_id: expired_isa_2}
    //   }, mock.res(function(res) {
    //     expect(res.error).to.equal(true)
    //     expect(res.status).to.equal(400)
    //     expect(res.message).to.equal('information_sharing_agreement expired')
    //     done()
    //   }))
    // })

    it('should respond with an object containing records referenced by isp records associated with the specified isa record', function(done) {
      mgmt_isa_pull_from.callback.call(mock.express, {
        user: {did: test_users[2].id},
        params: {isa_id: created_isa}
      }, mock.res(function(res) {
        expect(res.error).to.equal(false)
        expect(res.status).to.equal(200)
        expect(res.message).to.equal('ok')
        expect('user_data' in res.body).to.equal(true)
        done()
      }))
    })
  })

  describe(`${mgmt_isa_push_to.method.toUpperCase()} ${mgmt_isa_push_to.uri}`, function() {
    
    var expired_isa = created_isa_id
    var created_isa
    before(function(done) {
      mgmt_isa_req_create.callback.call(mock.express, {
        user: {did: test_users[2].id},
        body: {
          to: test_users[3].id,
          purpose: 'lolz',
          license: 'none',
          required_entities: ['/resource/foo/bar']
        }
      }, mock.res(function(res) {
        expect(typeof res.body.id).to.equal('number')

        mgmt_isa_req_res.callback.call(mock.express, {
          user: {did: test_users[3].id},
          params: {isar_id: res.body.id},
          body: {
            accepted: true,
            permitted_resources: [
              {id: 10e2, schema: 'bar'}
            ]
          }
        }, mock.res(function(res) {
          expect(typeof res.body.id).to.equal('number')
          
          created_isa = res.body.id
          done()
        }))
      }))
    })

    it('should respond with an error if required arguments are missing', function(done) {
      mgmt_isa_push_to.callback.call(mock.express, {
        user: {did: test_users[1].id},
        params: {isa_id: Number.MAX_VALUE},
        body: {}
      }, mock.res(function(res) {
        expect(res.error).to.equal(true)
        expect(res.status).to.equal(400)
        expect(res.message).to.equal('missing required arguments')
        
        mgmt_isa_push_to.callback.call(mock.express, {
          user: {did: test_users[1].id},
          params: {isa_id: Number.MAX_VALUE},
          body: {resources: []}
        }, mock.res(function(res) {
          expect(res.error).to.equal(true)
          expect(res.status).to.equal(400)
          expect(res.message).to.equal('missing required arguments')
          done()
        }))
      }))
    })

    it('should respond with an error if the specified isa record is not found or the calling user is not associated with the record', function(done) {
      mgmt_isa_push_to.callback.call(mock.express, {
        user: {did: test_users[1].id},
        params: {isa_id: Number.MAX_VALUE},
        body: {
          resources: [
            {value: 'foobar'}
          ]
        }
      }, mock.res(function(res) {
        expect(res.error).to.equal(true)
        expect(res.status).to.equal(404)
        expect(res.message).to.equal('information_sharing_agreement record not found')
        done()
      }))
    })

    // it('should respond with an error if the specified isa record has expired', function(done) {
    //   mgmt_isa_push_to.callback.call(mock.express, {
    //     user: {id: test_users[3].id},
    //     params: {isa_id: expired_isa_2},
    //     body: {
    //       resources: [
    //         {value: 'foo'}
    //       ]
    //     }
    //   }, mock.res(function(res) {
    //     expect(res.error).to.equal(true)
    //     expect(res.status).to.equal(400)
    //     expect(res.message).to.equal('information_sharing_agreement expired')
    //     done()
    //   }))
    // })

    it('should respond affirmatively if all given resource descriptions are written to database', function(done) {
      mgmt_isa_push_to.callback.call(mock.express, {
        user: {did: test_users[2].id},
        params: {isa_id: created_isa},
        body: {
          resources: [
            {name: 'foo', description: 'baz', value: 'foo bar', is_verifiable_claim: true},
            {name: 'bar', description: 'qux', value: 'baz qux'}
          ]
        }
      }, mock.res(function(res) {
        expect(res.error).to.equal(false)
        expect(res.status).to.equal(201)
        expect(res.message).to.equal('created')
        done()
      }))
    })
  })

  describe(`${mgmt_key_create.method.toUpperCase()} ${mgmt_key_create.uri}`, function() {
    
    var known_signature

    it('should fail if missing required arguments', function(done) {
      mgmt_key_create.callback.call(mock.express, {
        body: {
          // plaintext_proof: '',
          // signed_proof: '',
          // public_key: '',
          // public_key_algorithm: '',
          // alias: '',
          // purpose: ''
        }
      }, mock.res(function(res) {
        expect(res.error).to.equal(true)
        expect(res.status).to.equal(400)
        expect(res.message).to.equal('missing required arguments')
        done()
      }))
    })

    it('should fail if an unsupported key algo is specified', function(done) {
      mgmt_key_create.callback.call(mock.express, {
        body: {
          plaintext_proof: 'foo',
          signed_proof: 'foo',
          public_key: 'foo',
          public_key_algorithm: 'unsupported',
          alias: 'foo',
          purpose: 'foo'
        }
      }, mock.res(function(res) {
        expect(res.error).to.equal(true)
        expect(res.status).to.equal(400)
        expect(res.message).to.equal('unsupported key algorithm')
        done()
      }))
    })

    it.skip('should fail if unparsable signature parameters are given', function(done) {})

    it('should create a new crypto key record if all arguments check-out', function(done) {
      var now = Date.now()
      var plaintext_proof = `u10_${now}`
      var private_key = rsa.generatePrivateKey()
      var signed_proof = private_key.hashAndSign('sha256', plaintext_proof, 'utf8', 'base64', false)
      known_signature = signed_proof
      mgmt_key_create.callback.call(mock.express, {
        user: {id: test_users[0].id},
        body: {
          plaintext_proof: plaintext_proof,
          signed_proof: signed_proof,
          public_key: private_key.toPublicPem().toString('utf8'),
          public_key_algorithm: 'rsa',
          alias: 'foo',
          purpose: 'foo'
        }
      }, mock.res(function(res) {
        expect(res.error).to.equal(false)
        expect(res.status).to.equal(201)
        done()
      }))
    })

    it('should fail if a known signature is given', function(done) {
      var now = Date.now()
      var plaintext_proof = `u11_${now}`
      var private_key = rsa.generatePrivateKey()
      mgmt_key_create.callback.call(mock.express, {
        user: {id: test_users[0].id},
        body: {
          plaintext_proof: plaintext_proof,
          signed_proof: known_signature,
          public_key: private_key.toPublicPem().toString('utf8'),
          public_key_algorithm: 'rsa',
          alias: 'foo',
          purpose: 'foo'
        }
      }, mock.res(function(res) {
        expect(res.error).to.equal(true)
        expect(res.status).to.equal(400)
        expect(res.message).to.equal('detected known signature')
        done()
      }))
    })

    it('should fail if a duplicate alias is given', function(done) {
      var now = Date.now()
      var plaintext_proof = `u10_${now}`
      var private_key = rsa.generatePrivateKey()
      var signed_proof = private_key.hashAndSign('sha256', plaintext_proof, 'utf8', 'base64', false)
      mgmt_key_create.callback.call(mock.express, {
        user: {id: test_users[0].id},
        body: {
          plaintext_proof: plaintext_proof,
          signed_proof: signed_proof,
          public_key: private_key.toPublicPem().toString('utf8'),
          public_key_algorithm: 'rsa',
          alias: 'foo',
          purpose: 'foo'
        }
      }, mock.res(function(res) {
        expect(res.error).to.equal(true)
        expect(res.status).to.equal(400)
        expect(res.message).to.equal('duplicate key alias')
        done()
      }))
    })

  })

  describe(`${mgmt_key_get.method.toUpperCase()} ${mgmt_key_get.uri}`, function() {
    
    it('should respond with an error if the specified user has no key', function(done) {
      mgmt_key_get.callback.call(mock.express, {
        params: {user_did: Date.now()},
        query: {}
      }, mock.res(function(res) {
        expect(res.error).to.equal(true)
        expect(res.status).to.equal(404)
        expect(res.body).to.equal(null)
        done()
      }))
    })

    it('should respond with an error if the specified user has no key aliased with given alias', function(done) {
      mgmt_key_get.callback.call(mock.express, {
        params: {user_did: test_users[0].id},
        query: {alias: 'foobar'}
      }, mock.res(function(res) {
        expect(res.error).to.equal(true)
        expect(res.status).to.equal(404)
        expect(res.body).to.equal(null)
        done()
      }))
    })

    it('should respond with key data if the specified user has a key', function(done) {
      mgmt_key_get.callback.call(mock.express, {
        params: {user_did: test_users[0].id},
        query: {}
      }, mock.res(function(res) {
        expect(res.error).to.equal(false)
        expect(res.status).to.equal(200)
        expect(typeof res.body).to.equal('object')
        expect(!!res.body.public_key).to.equal(true)
        done()
      }))
    })

    it('should respond with key data if the specified user has a key aliased with the given alias', function(done) {
      mgmt_key_get.callback.call(mock.express, {
        params: {user_did: test_users[4].id},
        query: {alias: 'fingerprint'}
      }, mock.res(function(res) {
        expect(res.error).to.equal(false)
        expect(res.status).to.equal(200)
        expect(typeof res.body).to.equal('object')
        expect(!!res.body.public_key).to.equal(true)
        done()
      }))
    })
  })

  describe(`${mgmt_action_create.method.toUpperCase()} ${mgmt_action_create.uri}`, function() {

    it('should respond with an error if required arguments are missing', function(done) {
      mgmt_action_create.callback.call(mock.express, {
        user: {id: test_users[4].id},
        body: {
          name: '',
          purpose: '',
          license: '',
          entities: [],
          duration_days: null
        }
      }, mock.res(function(res) {
        expect(res.error).to.equal(true)
        expect(res.status).to.equal(400)
        expect(res.message).to.equal('missing required arguments')
        done()
      }))
    })

    it('should respond with an error if name contains whitespace', function(done) {
      mgmt_action_create.callback.call(mock.express, {
        user: {id: test_users[4].id},
        body: {
          name: ' ',
          purpose: 'foo',
          license: 'bar',
          entities: ['baz'],
          duration_days: 1
        }
      }, mock.res(function(res) {
        expect(res.error).to.equal(true)
        expect(res.status).to.equal(400)
        expect(res.message).to.equal('name cannot contain whitespace')
        expect(res.body).to.equal(null)
        done()
      }))
    })

    it('should respond with the id of the action that is created', function(done) {
      mgmt_action_create.callback.call(mock.express, {
        user: {id: test_users[4].id},
        body: {
          name: 'foo',
          purpose: 'foo',
          license: 'bar',
          entities: ['baz'],
          duration_days: 1
        }
      }, mock.res(function(res) {
        expect(res.error).to.equal(false)
        expect(res.status).to.equal(201)
        expect(res.message).to.equal('created')
        expect(res.body).to.equal(null)
        action_delete_id = 'foo'
        done()
      }))
    })

    it('should respond with an error if attempting to use a name that already exists', function(done) {
      mgmt_action_create.callback.call(mock.express, {
        user: {id: test_users[4].id},
        body: {
          name: 'foo',
          purpose: 'foo',
          license: 'bar',
          entities: ['baz'],
          duration_days: 1
        }
      }, mock.res(function(res) {
        expect(res.error).to.equal(true)
        expect(res.status).to.equal(400)
        expect(res.message).to.equal('user_action record already exists')
        expect(res.body).to.equal(null)
        done()
      }))
    })
  })

  describe(`${mgmt_action_user_get_all.method.toUpperCase()} ${mgmt_action_user_get_all.uri}`, function() {
    it('should respond with an array of the calling user\'s actions', function(done) {
      mgmt_action_user_get_all.callback.call(mock.express, {
        user: {id: test_users[4].id},
      }, mock.res(function(res) {
        expect(res.error).to.equal(false)
        expect(res.status).to.equal(200)
        expect(res.message).to.equal('ok')
        expect(Array.isArray(res.body)).to.equal(true)
        expect(res.body.length).to.equal(1)
        done()
      }))
    })
  })

  describe(`${mgmt_action_get_all.method.toUpperCase()} ${mgmt_action_get_all.uri}`, function() {

    it('should respond with an array of actions', function(done) {
      mgmt_action_get_all.callback.call(mock.express, {
        params: {user_did: test_users[4].id}
      }, mock.res(function(res) {
        expect(res.error).to.equal(false)
        expect(res.status).to.equal(200)
        expect(res.message).to.equal('ok')
        expect(Array.isArray(res.body)).to.equal(true)
        expect(res.body.length).to.equal(1)
        done()
      }))
    })
  })

  describe(`${mgmt_action_get_one.method.toUpperCase()} ${mgmt_action_get_one.uri}`, function() {

    it('should respond with not found if the action does not exist', function(done) {
      mgmt_action_get_one.callback.call(mock.express, {
        params: {
          user_did: test_users[4].id,
          action_name: 'bar'
        }
      }, mock.res(function(res) {
        expect(res.error).to.equal(true)
        expect(res.status).to.equal(404)
        expect(res.message).to.equal('user_action record not found')
        done()
      }))
    })

    it('should respond with the requested action and have a signature appended to the body', function(done) {
      mgmt_action_get_all.callback.call(mock.express, {
        params: {user_did: test_users[4].id}
      }, mock.res(function(res) {
        var action_name = res.body[0].name

        mgmt_action_get_one.callback.call(mock.express, {
          params: {
            user_did: test_users[4].id,
            action_name: action_name
          }
        }, mock.res(function(res) {
          expect(res.error).to.equal(false)
          expect(res.status).to.equal(200)
          expect(res.message).to.equal('ok')
          expect(typeof res.body).to.equal('object')
          expect(!!res.body).to.equal(true)
          done()
        }))
      }))
    })
  })

  describe(`${mgmt_isa_by_action.method.toUpperCase()} ${mgmt_isa_by_action.uri}`, function() {

    it('should respond with an error if missing required arguments', function(done) {
      mgmt_isa_by_action.callback.call(mock.express, {
        params: {action_name: 'foo', user_did: 'foo'},
        body: {}
      }, mock.res(function(res) {
        expect(res.error).to.equal(true)
        expect(res.status).to.equal(400)
        expect(res.message).to.equal('missing required arguments')

        mgmt_isa_by_action.callback.call(mock.express, {
          params: {action_name: 'foo', user_did: 'foo'},
          body: {entities: []}
        }, mock.res(function(res) {
          expect(res.error).to.equal(true)
          expect(res.status).to.equal(400)
          expect(res.message).to.equal('missing required arguments')
          done()
        }))
      }))
    })

    it.skip('should respond with an error if it cannot find the specified action', function(done) {})

    it('should establish a new isa', function(done) {

      mgmt_action_get_all.callback.call(mock.express, {
        params: {user_did: test_users[4].id}
      }, mock.res(function(res) {
        
        var action_name = res.body[0].name
        
        mgmt_action_get_one.callback.call(mock.express, {
          params: {
            user_did: test_users[4].id,
            action_name: action_name
          }
        }, mock.res(function(res) {
          
          mgmt_isa_by_action.callback.call(mock.express, {
            user: {did: test_users[0].id},
            params: {user_did: test_users[4].id, action_name: action_name},
            body: {entities: [1, 2, 3, 4]}
          }, mock.res(function(res) {
            expect(res.error).to.equal(false)
            expect(res.status).to.equal(201)
            expect(res.message).to.equal('created information_sharing_agreement record')
            expect(typeof res.body).to.equal('object')
            expect(typeof res.body.id).to.equal('number')
            actions_receipts_isa_id = res.body.id
            done()
          }))
        }))
      }))
    })
  })

  describe(`${mgmt_isa_receipt.method.toUpperCase()} ${mgmt_isa_receipt.uri}`, function() {
    
    it('should respond with an error if the caller is not related to the isa record', function(done) {
      mgmt_isa_receipt.callback.call(mock.express, {
        user: {did: ''+test_users[2].id},
        params: {isa_id: actions_receipts_isa_id}
      }, mock.res(function(res) {
        expect(res.error).to.equal(true)
        expect(res.status).to.equal(404)
        expect(res.message).to.equal('information_sharing_agreement record not found')
        expect(res.body).to.equal(null)
        done()
      }))
    })
    
    it('should respond with an error if the isa record does not exist', function(done) {
      mgmt_isa_receipt.callback.call(mock.express, {
        user: {did: ''+test_users[2].id},
        params: {isa_id: 'foo'}
      }, mock.res(function(res) {
        expect(res.error).to.equal(true)
        expect(res.status).to.equal(404)
        expect(res.message).to.equal('information_sharing_agreement record not found')
        expect(res.body).to.equal(null)
        done()
      }))
    })
    
    it('should respond with a receipt object that has signatures attached', function(done) {
      mgmt_isa_receipt.callback.call(mock.express, {
        user: {did: ''+test_users[4].id},
        params: {isa_id: actions_receipts_isa_id}
      }, mock.res(function(res) {
        expect(res.error).to.equal(false)
        expect(res.status).to.equal(200)
        expect(res.message).to.equal('ok')
        expect(typeof res.body).to.equal('object')
        expect(typeof res.body.isaSignatureValue).to.equal('string')
        expect(typeof res.body.isa.requestSignatureValue).to.equal('string')
        done()
      }))
    })
  })

  describe(`${mgmt_action_delete.method.toUpperCase()} ${mgmt_action_delete.uri}`, function() {

    it('should respond with an error if the action was not found', function(done) {
      mgmt_action_delete.callback.call(mock.express, {
        user: {id: test_users[4].id},
        params: {action_name: 'bar'}
      }, mock.res(function(res) {
        expect(res.error).to.equal(true)
        expect(res.status).to.equal(404)
        expect(res.message).to.equal('user_action record not found')
        expect(res.body).to.equal(null)
        done()
      }))
    })

    it('should respond with a number if the record was deleted', function(done) {
      mgmt_action_delete.callback.call(mock.express, {
        user: {id: test_users[4].id},
        params: {action_name: action_delete_id}
      }, mock.res(function(res) {
        expect(res.error).to.equal(false)
        expect(res.status).to.equal(200)
        expect(res.message).to.equal('ok')
        expect(typeof res.body).to.equal('object')
        expect(typeof res.body.user_action).to.equal('number')
        expect(res.body.user_action).to.equal(1)
        done()
      }))
    })
  })

  describe(`${mgmt_face_verify_create.method.toUpperCase()} ${mgmt_face_verify_create.uri}`, function() {
    it('should create a token record and respond', function(done) {
      mgmt_face_verify_create.callback.call(mock.express, {
        query: {user_did: test_users[1].id}
      }, mock.res(function() {
        mock.express.models.facial_verification.findOne({
          where: {subject_did: test_users[1].id}
        }).then(function(found) {
          expect(typeof found.token).to.equal('string')
          expect(!!found.token).to.equal(true)
          done()
        }).catch(done)
      }))
    })
  })

  describe(`${mgmt_face_verify_get.method.toUpperCase()} ${mgmt_face_verify_get.uri}`, function() {
    
    before(function(done) {
      mock.express.models.user_datum.create({
        owner_id: test_users[1].id,
        schema: 'schema.cnsnt.io/person',
        entity: 'person',
        attribute: 'face',
        value: 'foo',
        mime: 'application/ld+json',
        encoding: 'utf8',
        alias: 'my picture'
      }).then(function(created) {
        face_verify_token = 'foo_' + Date.now()
        return mock.express.models.facial_verification.create({
          subject_did: test_users[1].id,
          token: face_verify_token
        })
      }).then(
        done.bind(done, null)
      ).catch(done)
    })

    it('should respond with a person schema instance', function(done) {
      mgmt_face_verify_get.callback.call(mock.express, {
        user: {did: test_users[2].id},
        params: {
          user_did: test_users[1].id,
          token: face_verify_token
        }
      }, mock.res(function(res) {
        expect(res.error).to.equal(false)
        expect(res.status).to.equal(200)
        expect(res.message).to.equal('ok')
        expect(typeof res.body).to.equal('object')
        expect(res.body).to.not.equal(null)
        done()
      }))
    })
  })

  describe(`${mgmt_face_verify_respond.method.toUpperCase()} ${mgmt_face_verify_respond.uri}`, function() {
    it('should respond with error if required arguments are missing', function(done) {
      mgmt_face_verify_respond.callback.call(mock.express, {
        user: {did: test_users[2].id},
        body: {},
        params: {
          user_did: test_users[1].id,
          token: face_verify_token
        }
      }, mock.res(function(res) {
        expect(res.error).to.equal(true)
        expect(res.status).to.equal(400)
        expect(res.message).to.equal('missing required arguments')
        expect(res.body).to.equal(null)
        done()
      }))
    })

    it('should respond with success if verfication was responded to', function(done) {
      mgmt_face_verify_respond.callback.call(mock.express, {
        user: {id: test_users[2].id, did: test_users[2].id},
        body: {result: 'yes'},
        params: {
          user_did: test_users[1].id,
          token: face_verify_token
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

  describe(`${mgmt_message.method.toUpperCase()} ${mgmt_message.uri}`, function() {
    
    before(function(done) {
      mock.express.models.user_connection.create({
        from_did: test_users[3].id,
        to_did: test_users[2].id,
        enabled: true
      }).then(
        done.bind(done, null)
      ).catch(done)
    })

    it('should return an error if message is too large', function(done) {
      mgmt_message.callback.call(mock.express, {
        user: {did: test_users[3].id},
        body: {
          msg: {length: 4097},
          recipient: test_users[2].id
        }
      }, mock.res(function(res) {
        expect(res.error).to.equal(true)
        expect(res.message).to.equal('4096 byte limit exceeded')
        expect(res.status).to.equal(400)
        done()
      }))
    })

    it('should return an error if the user is not connected with the recipient', function(done) {
      mgmt_message.callback.call(mock.express, {
        user: {did: test_users[3].id},
        body: {
          msg: 'foo',
          recipient: 'foo'
        }
      }, mock.res(function(res) {
        expect(res.error).to.equal(true)
        expect(res.message).to.equal('user_connection record not found')
        expect(res.status).to.equal(404)
        done()
      }))
    })

    it('should respond with 200 if the message was sent', function(done) {
      mgmt_message.callback.call(mock.express, {
        user: {did: test_users[3].id},
        body: {
          msg: 'foo',
          recipient: test_users[2].id
        }
      }, mock.res(function(res) {
        var cd = process.get_call_data()
        var msg = cd.call_args[cd.call_count].notification_request
        expect(res.error).to.equal(false)
        expect(res.status).to.equal(200)
        expect(msg.data.type).to.equal('user_message_received')
        done()
      }))
    })
  })

  describe(`${mgmt_send_thanks.method.toUpperCase()} ${mgmt_send_thanks.uri}`, function() {

    it('should trigger a call to notifier service if user is found', function(done) {
      mgmt_send_thanks.callback.call(mock.express, {
        user: {did: test_users[1].id},
        body: {amount: 10, recipient: test_users[2].id, reason: 'foo'}
      }, mock.res(function(res) {
        expect(res.error).to.equal(false)
        expect(res.status).to.equal(200)
        expect(res.message).to.equal('ok')
        expect(res.body).to.equal(null)
        var cd = process.get_call_data()
        var last_send = cd.call_args[cd.call_count]
        expect(last_send.notification_request.user_id).to.equal(test_users[2].id)
        done()
      }))
    })

    it('should respond with error if user not found', function(done) {
      mgmt_send_thanks.callback.call(mock.express, {
        user: {did: test_users[1].id},
        body: {amount: 10, recipient: 'foo', reason: 'foo'}
      }, mock.res(function(res) {
        expect(res.error).to.equal(true)
        expect(res.status).to.equal(404)
        expect(res.message).to.equal('user record not found')
        expect(res.body).to.equal(null)
        done()
      }))
    })
  })
})
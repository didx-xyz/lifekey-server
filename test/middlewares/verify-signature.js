
'use strict'

var crypto = require('crypto')

var {expect} = require('chai')
var secp = require('secp256k1')
var ursa = require('ursa')

var mock = require('../mock/express')

var subject = require('../../src/middlewares/verify-signature')

var privatekey, privatekey2, publickey, publickey2, plain, hashed, signed, signed2

var rsa_plain, rsa_hashed, rsa_privatekey, rsa_publickey, rsa_privatekey2, rsa_publickey2, rsa_signer, rsa_signer2, rsa_signed, rsa_signed2

before(function(done) {
  plain = 'foobar'
  hashed = crypto.createHash('sha256').update(plain).digest()
  do {
    privatekey = crypto.randomBytes(32)
    privatekey2 = crypto.randomBytes(32)
  } while (!(secp.privateKeyVerify(privatekey) &&
             secp.privateKeyVerify(privatekey2)))
  signed = secp.sign(hashed, privatekey).signature.toString('hex')
  signed2 = secp.sign(hashed, privatekey2).signature.toString('hex')
  publickey = secp.publicKeyCreate(privatekey)
  publickey2 = secp.publicKeyCreate(privatekey2)


  rsa_plain = 'foobar'
  rsa_hashed = crypto.createHash('sha256').update(rsa_plain).digest('hex')
  
  rsa_privatekey = ursa.generatePrivateKey()
  rsa_publickey = rsa_privatekey.toPublicPem('utf8')

  rsa_privatekey2 = ursa.generatePrivateKey()
  rsa_publickey2 = rsa_privatekey2.toPublicPem('utf8')

  rsa_signed = rsa_privatekey.hashAndSign('sha256', Buffer.from(rsa_plain), 'utf8', 'hex', true)
  rsa_signed2 = rsa_privatekey2.hashAndSign('sha256', Buffer.from(rsa_plain), 'utf8', 'hex', true)

  done()
})

describe('middleware verify-signature', function() {
  
  it('should respond with bad request if non-hexadecimal headers are given', function(done) {
    subject.call(mock.express, {
      skip_secure_checks: false,
      headers: {
        'x-cnsnt-plain': 'foo',
        'x-cnsnt-signable': '<>',
        'x-cnsnt-signed': '<>'
      }
    }, mock.res(function(res) {
      expect(res.error).to.equal(true)
      expect(res.status).to.equal(400)
      expect(res.message).to.equal('error parsing any of: x-cnsnt-signable, x-cnsnt-signed, x-cnsnt-plain')
      done()
    }), done.bind(
      done, new Error('should not have been called')
    ))
  })

  it('should respond with an error if the signature verification fails for secp256k1', function(done) {
    subject.call(mock.express, {
      skip_secure_checks: false,
      user: {
        crypto: {
          public_key: publickey,
          algorithm: 'secp256k1'
        }
      },
      headers: {
        'x-cnsnt-plain': plain,
        'x-cnsnt-signable': hashed.toString('hex'),
        'x-cnsnt-signed': signed2
      }
    }, mock.res(function(res) {
      expect(res.error).to.equal(true)
      expect(res.status).to.equal(400)
      expect(res.message).to.equal('signature verification failure')
      done()
    }), done.bind(
      done, new Error('should not have been called')
    ))
  })
  
  it('should invoke the success callback if signature verification succeeds for secp256k1', function(done) {
    subject.call(mock.express, {
      skip_secure_checks: false,
      user: {
        crypto: {
          public_key: publickey,
          algorithm: 'secp256k1'
        }
      },
      headers: {
        'x-cnsnt-plain': plain,
        'x-cnsnt-signable': hashed.toString('hex'),
        'x-cnsnt-signed': signed
      }
    }, done.bind(
      done, new Error('should not have been called')
    ), done)
  })

  it('should respond with an error if the signature verification fails for rsa', function(done) {
    subject.call(mock.express, {
      skip_secure_checks: false,
      user: {
        crypto: {
          public_key: rsa_publickey,
          algorithm: 'rsa'
        }
      },
      headers: {
        'x-cnsnt-plain': rsa_plain,
        'x-cnsnt-signable': rsa_hashed,
        'x-cnsnt-signed': rsa_signed2
      }
    }, mock.res(function(res) {
      expect(res.error).to.equal(true)
      expect(res.status).to.equal(400)
      expect(res.message).to.equal('signature verification failure')
      done()
    }), done.bind(
      done, new Error('should not have been called')
    ))
  })
  
  it('should invoke the success callback if signature verification succeeds for rsa', function(done) {
    subject.call(mock.express, {
      skip_secure_checks: false,
      user: {
        crypto: {
          public_key: rsa_publickey,
          algorithm: 'rsa'
        }
      },
      headers: {
        'x-cnsnt-plain': rsa_plain,
        'x-cnsnt-signable': rsa_hashed,
        'x-cnsnt-signed': rsa_signed
      }
    }, done.bind(
      done, new Error('should not have been called')
    ), done)
  })

  it('should respond with an error if an unsupported algorithm is specified', function(done) {
    subject.call(
      mock.express,
      {
        skip_secure_checks: false,
        user: {crypto: {algorithm: 'foo'}},
        headers: {
          'x-cnsnt-plain': 'foo',
          'x-cnsnt-signable': 'deadbeef',
          'x-cnsnt-signed': 'deadbeef'
        }
      },
      mock.res(function(res) {
        expect(res.error).to.equal(true)
        expect(res.status).to.equal(500)
        expect(res.message).to.equal('unsupported key algorithm foo')
        done()
      }),
      done.bind(done, new Error('should not have been called'))
    )
  })
})
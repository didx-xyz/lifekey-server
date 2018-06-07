
'use strict'

var crypto = require('crypto')

var {expect} = require('chai')
var secp = require('secp256k1')
var rsa = require('node-rsa')

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
  signed = secp.sign(hashed, privatekey).signature.toString('base64')
  signed2 = secp.sign(hashed, privatekey2).signature.toString('base64')
  publickey = secp.publicKeyCreate(privatekey)
  publickey2 = secp.publicKeyCreate(privatekey2)


  rsa_plain = 'foobar'
  rsa_hashed = crypto.createHash('sha256').update(rsa_plain).digest('hex')

  rsa_privatekey = new rsa({bits: 4096})
  var private_key_pem = rsa_privatekey.exportKey()
  rsa_publickey = private_key_pem.exportKey('pkcs1-public')

  rsa_privatekey2 = new rsa({bits: 4096})
  var private_key_pem2 = rsa_privatekey2.exportKey()
  rsa_publickey2 = private_key_pem2.exportKey('pkcs1-public')

  var signer = crypto.createSign('RSA-SHA256')
  signer.update(rsa_plain)
  rsa_signed = signer.sign(private_key_pem, 'base64')

  var signer2 = crypto.createSign('RSA-SHA256')
  signer2.update(rsa_plain)
  rsa_signed2 = signer2.sign(private_key_pem2, 'base64')

  done()
})

describe('middleware verify-signature', function() {
  
  it('should respond with bad request if non-base64 and utf8 headers are given', function(done) {
    subject.call(mock.express, {
      headers: {
        'x-cnsnt-plain': '',
        'x-cnsnt-signed': '<>'
      }
    }, mock.res(function(res) {
      expect(res.error).to.equal(true)
      expect(res.status).to.equal(400)
      expect(res.message).to.equal('error base64-parsing or shasumming any of: x-cnsnt-plain, x-cnsnt-signed')
      done()
    }), done.bind(
      done, new Error('should not have been called')
    ))
  })

  it('should respond with an error if the signature verification fails for secp256k1', function(done) {
    subject.call(mock.express, {
      user: {
        crypto: {
          public_key: publickey,
          algorithm: 'secp256k1'
        }
      },
      headers: {
        'x-cnsnt-plain': plain,
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
      user: {
        crypto: {
          public_key: publickey,
          algorithm: 'secp256k1'
        }
      },
      headers: {
        'x-cnsnt-plain': plain,
        'x-cnsnt-signed': signed
      }
    }, mock.res(function(res) {
      return done(new Error('should not have been called'))
    }), done)
  })

  it('should respond with an error if the signature verification fails for rsa', function(done) {
    subject.call(mock.express, {
      user: {
        crypto: {
          public_key: rsa_publickey,
          algorithm: 'rsa'
        }
      },
      headers: {
        'x-cnsnt-plain': rsa_plain,
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
      user: {
        crypto: {
          public_key: rsa_publickey,
          algorithm: 'rsa'
        }
      },
      headers: {
        'x-cnsnt-plain': rsa_plain,
        'x-cnsnt-signed': rsa_signed
      }
    }, mock.res(function(res) {
      return done(new Error('should not have been called'))
    }), done)
  })

  it('should respond with an error if an unsupported algorithm is specified', function(done) {
    subject.call(mock.express, {
      user: {crypto: {algorithm: 'foo'}},
      headers: {
        'x-cnsnt-plain': 'foo',
        'x-cnsnt-signed': 'deadbeef'
      }
    }, mock.res(function(res) {
      expect(res.error).to.equal(true)
      expect(res.status).to.equal(500)
      expect(res.message).to.equal('unsupported key algorithm foo')
      done()
    }), done.bind(done, new Error('should not have been called')))
  })
})

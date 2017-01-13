
'use strict'

var fcm = require('../messaging/fcm')

module.exports = [
  {
    uri: '/isa',
    method: 'post',
    callback: function(req, res) {
      
      // TODO
      // the `to` field needs to be encoded in jsonld and queried out
      var {document, to} = req.body
      var {token, user, information_sharing_agreement} = this.get('models')

      // TODO
      // the calling agent needs to be authenticated
      var token = req.headers['x-cnsnt-token']
      var fromid, toid

      // find the calling agent user id
      token.findOne({
        where: {value: token}
      }).then(function(found) {
        if (found) {
          fromid = found.id
          return user.findOne({where: {did: to}})
        }
        res.status(404)
        return res.json({
          error: true,
          status: 404,
          message: 'user not found',
          body: null
        })
      }).then(function(found) {
        if (found) {
          toid = found.id
          return information_sharing_agreement.create({
            from_id: fromid,
            to_id: toid,
            document: document
          })
        }
        res.status(404)
        return res.json({
          error: true,
          status: 404,
          message: 'user not found',
          body: null
        })
      }).then(function(created) {


        // TODO
        // query user device id from database
        // then send message via fcm


      }).catch(function(err) {
        res.status(500)
        return res.json({
          error: true,
          status: 500,
          message: 'internal server error',
          body: null
        })
      })
    }
  },
  {
    uri: '/isa/:uuid',
    method: 'post',
    callback: function(req, res) {
      // this is the ISA reply endpoint
    }
  },
  {
    uri: '/isa',
    method: 'get',
    callback: function(req, res) {
      var {acknowledged, agreed, from} = req.query
      var {token, user, information_sharing_agreement} = this.get('models')
      var token = req.headers['x-cnsnt-token']
      var toid
      token.findOne({
        where: {value: token}
      }).then(function(found) {
        if (found) {
          toid = found.id
          var isafilters = {to_id: toid}
          if (acknowledged !== '') isafilters.acknowledged = acknowledged
          if (agreed !== '') isafilters.agreed = agreed
          return information_sharing_agreement.findAll({where: isafilters})
        }
        res.status(404)
        return res.json({
          error: true,
          status: 404,
          message: 'user not found',
          body: null
        })
      }).then(function(foundall) {
        res.status(200)
        return res.json({
          error: false,
          status: 200,
          message: 'ok',
          body: foundall.map(f => f.get('plain'))
        })
      }).catch(function(err) {
        res.status(500)
        return res.json({
          error: true,
          status: 500,
          message: 'internal server error',
          body: null
        })
      })
    }
  },
  {
    uri: '/isa/:uuid',
    method: 'get',
    callback: function(req, res) {}
  },
  {
    uri: '/isa/:uuid',
    method: 'delete',
    callback: function(req, res) {}
  }
]
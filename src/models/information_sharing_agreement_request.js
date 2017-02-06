
'use strict'

module.exports = function(instance, sqlize) {
  return instance.define('information_sharing_agreement_request', {
    from_id: {
      type: sqlize.INTEGER,
      allowNull: true
    },
    from_did: {
      type: sqlize.STRING,
      allowNull: true
    },
    from_url: {
      type: sqlize.TEXT,
      allowNull: true
    },
    to_id: {
      type: sqlize.INTEGER,
      allowNull: true
    },
    to_did: {
      type: sqlize.STRING,
      allowNull: true
    },
    to_url: {
      type: sqlize.TEXT,
      allowNull: true
    },
    document: {
      type: sqlize.TEXT,
      allowNull: false
    },
    acknowledged: {
      type: sqlize.BOOLEAN,
      allowNull: true
    },
    purpose: {
      type: sqlize.STRING,
      allowNull: false
    },
    license: {
      type: sqlize.STRING,
      allowNull: true
    },
    resolution: {
      type: sqlize.BOOLEAN,
      allowNull: true
    },
    resolver_signature: {
      type: sqlize.TEXT,
      allowNull: true
    },
    resolver_signing_key_id: {
      type: sqlize.INTEGER,
      allowNull: true
    },
    acknowledged_at: {
      type: sqlize.DATE,
      allowNull: true
    },
    resolved_at: {
      type: sqlize.DATE,
      allowNull: true
    },
    expires_at: {
      type: sqlize.DATE,
      allowNull: true
    }
  }, {
    timestamps: true,
    paranoid: true,
    underscored: true,
    comment: 'information sharing agreements in jsonld format'
  })
}
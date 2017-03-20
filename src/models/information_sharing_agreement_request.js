
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
    to_id: {
      type: sqlize.INTEGER,
      allowNull: true
    },
    to_did: {
      type: sqlize.STRING,
      allowNull: true
    },
    acknowledged: {
      type: sqlize.BOOLEAN,
      allowNull: true
    },
    optional_schemas: {
      type: sqlize.TEXT,
      allowNull: true
    },
    requested_schemas: {
      type: sqlize.TEXT,
      allowNull: false
    },
    purpose: {
      type: sqlize.STRING,
      allowNull: false
    },
    license: {
      type: sqlize.STRING,
      allowNull: true
    },
    accepted: {
      type: sqlize.BOOLEAN,
      allowNull: true
    },
    expires_at: {
      type: sqlize.DATE,
      allowNull: true
    },
    acknowledged_at: {
      type: sqlize.DATE,
      allowNull: true
    },
    resolved_at: {
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
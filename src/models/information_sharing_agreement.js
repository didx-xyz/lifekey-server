
// TODO
// add more fields to fully record the
// json ld document after parsing/normalising
// to support more powerful queries

// maybe look into more powerful database tools 
// (json columns, altering onthefly w/ pg?)

module.exports = function(instance, sqlize) {
  return instance.define('information_sharing_agreement', {
    from_did: {
      type: sqlize.STRING,
      allowNull: false
    },
    to_did: {
      type: sqlize.STRING,
      allowNull: false
    },
    document: {
      type: sqlize.TEXT,
      allowNull: false
    },
    verifiable_claim: {
      type: sqlize.BOOLEAN,
      allowNull: false
    },
    acknowledged: {
      type: sqlize.BOOLEAN,
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
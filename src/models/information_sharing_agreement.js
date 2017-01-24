
// TODO
// add more fields to fully record the
// json ld document after parsing/normalising
// to support more powerful queries

// maybe look into more powerful database tools 
// (json columns, altering onthefly w/ pg?)

module.exports = function(instance, sqlize) {
  return instance.define('information_sharing_agreement', {
    from_id: {
      type: sqlize.INTEGER,
      allowNull: false
    },
    to_id: {
      type: sqlize.INTEGER,
      allowNull: false
    },
    document: {
      type: sqlize.TEXT,
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
    resolverSignature: {
      type: sqlize.TEXT,
      allowNull: true
    },
    dateAcknowledged: {
      type: sqlize.DATE,
      allowNull: true
    },
    dateResolved: {
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
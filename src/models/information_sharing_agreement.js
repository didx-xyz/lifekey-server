
// TODO
// add more fields to fully record the
// json ld document after parsing/normalising
// to support more powerful queries

// maybe look into more powerful database tools 
// (json columns, altering onthefly w/ pg?)

module.exports = function(instance, sqlize) {
  return instance.define('information_sharing_agreement', {
    information_sharing_agreement_request_id: {
      type: sqlize.INTEGER,
      allowNull: false,
      unique: true
    },
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
    permitted_resource_uris: {
      type: sqlize.TEXT,
      allowNull: false
    },
    is_verifiable_claim: {
      type: sqlize.BOOLEAN,
      allowNull: false
    },
    expired: {
      type: sqlize.BOOLEAN,
      allowNull: true,
      defaultValue: false
    }
  }, {
    timestamps: true,
    paranoid: true,
    underscored: true,
    comment: 'information sharing agreements'
  })
}

module.exports = function(instance, sqlize) {
  return instance.define('information_sharing_agreement', {
    isar_id: {
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
    is_verifiable_claim: {
      type: sqlize.BOOLEAN,
      allowNull: true
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
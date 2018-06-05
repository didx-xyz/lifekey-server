
module.exports = function(instance, sqlize) {
  return instance.define('information_sharing_agreement', {
    isar_id: {
      type: sqlize.INTEGER,
      allowNull: false,
      unique: true
    },
    from_did: {
      type: sqlize.STRING,
      allowNull: false
    },
    to_did: {
      type: sqlize.STRING,
      allowNull: false
    },
    transaction_hash: {
      type: sqlize.STRING,
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
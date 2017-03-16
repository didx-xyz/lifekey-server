
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
    to_id: {
      type: sqlize.INTEGER,
      allowNull: true
    },
    to_did: {
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
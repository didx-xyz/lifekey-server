
module.exports = function(instance, sqlize) {
  return instance.define('facial_verification', {
    verifier_did: {
      type: sqlize.STRING,
      allowNull: true
    },
    subject_did: {
      type: sqlize.STRING,
      allowNull: false
    },
    token: {
      type: sqlize.STRING,
      allowNull: false,
      unique: true
    },
    result: {
      type: sqlize.STRING,
      allowNull: true
    }
  }, {
    timestamps: true,
    paranoid: true,
    underscored: true,
    comment: 'facial verification records'
  })
}
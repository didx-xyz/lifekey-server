
module.exports = function(instance, sqlize) {
  return instance.define('http_request_verification', {
    public_key: {
      type: sqlize.STRING,
      allowNull: false
    },
    algorithm: {
      type: sqlize.STRING,
      allowNull: false
    },
    plaintext: {
      type: sqlize.TEXT,
      allowNull: true
    },
    signable: {
      type: sqlize.STRING,
      allowNull: false
    },
    signature: {
      type: sqlize.TEXT,
      allowNull: false
    }
  }, {
    timestamps: true,
    paranoid: true,
    underscored: true,
    comment: 'signatures from web requests for posterity'
  })
}
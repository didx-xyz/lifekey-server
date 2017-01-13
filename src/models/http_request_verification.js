
module.exports = function(instance, sqlize) {
  return instance.define('http_request_verification', {
    public_key: {
      type: sqlize.BLOB,
      allowNull: false
    },
    signable: {
      type: sqlize.BLOB,
      allowNull: false
    }
  }, {
    timestamps: true,
    paranoid: true,
    underscored: true,
    comment: 'signatures from web requests for posterity'
  })
}
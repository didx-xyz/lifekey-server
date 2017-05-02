
module.exports = function(instance, sqlize) {
  return instance.define('isa_receipt_transaction', {
    isa_id: {
      type: sqlize.INTEGER,
      allowNull: true
    },
    receipt_hash: {
      type: sqlize.STRING,
      allowNull: false
    },
    transaction_hash: {
      type: sqlize.STRING,
      allowNull: false,
      unique: true
    }
  }, {
    timestamps: true,
    paranoid: false,
    underscored: true,
  })
}
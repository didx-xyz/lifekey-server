
module.exports = function(instance, sqlize) {
  return instance.define('information_sharing_agreement_recepit', {
    isar_id: {
      type: sqlize.INTEGER,
      allowNull: false,
      unique: true
    },
    isa_id: {
      type: sqlize.INTEGER,
      allowNull: false,
      unique: true
    },
    receipt: {
      type: sqlize.TEXT,
      allowNull: false
    }
  }, {
    timestamps: true,
    paranoid: true,
    underscored: true,
    comment: 'information sharing agreements'
  })
}
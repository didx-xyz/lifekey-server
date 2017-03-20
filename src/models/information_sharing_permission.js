
module.exports = function(instance, sqlize) {
  return instance.define('information_sharing_permission', {
    isa_id: {
      type: sqlize.INTEGER,
      allowNull: false
    },
    user_datum_id: {
      type: sqlize.INTEGER,
      allowNull: false
    }
  }, {
    timestamps: true,
    paranoid: true,
    underscored: true,
    comment: 'information sharing agreements'
  })
}
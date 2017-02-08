
module.exports = function(instance, sqlize) {
  return instance.define('information_sharing_permission', {
    isa_id: {
      type: sqlize.INTEGER,
      allowNull: false
    },
    resource_uri: {
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

module.exports = function(instance, sqlize) {
  return instance.define('user_action_log', {
    from_id: {
      type: sqlize.INTEGER, 
      allowNull: false
    },
    to_id: {
      type: sqlize.INTEGER, 
      allowNull: false
    },
    object_type: {
      type: sqlize.STRING, 
      allowNull: false
    },
    action: {
      type: sqlize.STRING, 
      allowNull: false
    }
  }, {
    timestamps: true,
    paranoid: true,
    underscored: true,
    comment: 'event logs'
  })
}
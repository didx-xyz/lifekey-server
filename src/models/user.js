
module.exports = function(instance, sqlize) {
  return instance.define('user', {
    did: {
      type: sqlize.STRING,
      unique: true,
      allowNull: true
    },
    nickname: {
      type: sqlize.STRING,
      allowNull: false,
      unique: true
    },
    email: {
      type: sqlize.STRING,
      allowNull: false,
      unique: true,
      validate: {isEmail: true}
    },
    webhook_url: {
      type: sqlize.STRING,
      allowNull: true,
      unique: true
    },
    branding_image_uri: {
      type: sqlize.TEXT,
      allowNull: true
    },
    branding_colour_code: {
      type: sqlize.STRING,
      allowNull: true,
      defaultValue: '#1A7BFF'
    },
    app_activation_code: {
      type: sqlize.STRING,
      allowNull: false
    },
    app_activation_link_clicked: {
      type: sqlize.BOOLEAN,
      allowNull: false,
      defaultValue: false
    }
  }, {
    timestamps: true,
    paranoid: false,
    underscored: true,
    comment: 'end users'
  })
}
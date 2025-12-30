// server/models/User.js
const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  return sequelize.define('User', {
    username: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true
    },
    email: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
      validate: { isEmail: true }
    },
    password: {
      type: DataTypes.STRING,
      allowNull: false
    },
    role: {
      type: DataTypes.ENUM('admin', 'operator', 'viewer'),
      defaultValue: 'operator'
    },
    status: {
      type: DataTypes.ENUM('active', 'inactive'),
      defaultValue: 'active'
    },
    avatar: {
      type: DataTypes.STRING,
      allowNull: true,
      comment: '用户头像URL'
    }
  }, {
    tableName: 'users',
    timestamps: true
  });
};
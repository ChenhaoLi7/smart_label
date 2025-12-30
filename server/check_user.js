// 检查用户数据脚本
const { DataTypes } = require('sequelize');
const sequelize = require('./config/database');

const User = sequelize.define('User', {
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
  avatar: {
    type: DataTypes.STRING,
    allowNull: true,
    comment: '用户头像URL'
  }
}, {
  tableName: 'users',
  timestamps: true
});

async function checkUser() {
  try {
    const user = await User.findOne({
      where: { username: 'admin' }
    });
    
    if (user) {
      console.log('用户信息:', {
        id: user.id,
        username: user.username,
        email: user.email,
        avatar: user.avatar,
        createdAt: user.createdAt
      });
    } else {
      console.log('用户不存在');
    }
  } catch (error) {
    console.error('查询用户失败:', error.message);
  }
}

checkUser().then(() => {
  process.exit(0);
});

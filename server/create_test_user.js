// 创建测试用户脚本
const { User } = require('./models');
const bcrypt = require('bcryptjs');

// 临时使用简化模型
const { DataTypes } = require('sequelize');
const sequelize = require('./config/database');

const UserTemp = sequelize.define('User', {
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
  }
}, {
  tableName: 'users',
  timestamps: true
});

async function createTestUser() {
  try {
    // 检查用户是否已存在
    const existingUser = await UserTemp.findOne({
      where: { username: 'admin' }
    });
    
    if (existingUser) {
      console.log('用户已存在:', existingUser.username);
      return;
    }
    
    // 创建新用户
    const hashedPassword = await bcrypt.hash('admin123', 10);
    const user = await UserTemp.create({
      username: 'admin',
      email: 'admin@example.com',
      password: hashedPassword
    });
    
    console.log('用户创建成功:', user.username);
  } catch (error) {
    console.error('创建用户失败:', error.message);
  }
}

createTestUser().then(() => {
  process.exit(0);
});

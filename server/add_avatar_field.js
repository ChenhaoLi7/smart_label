// 添加avatar字段到数据库
const sequelize = require('./config/database');

async function addAvatarColumn() {
  try {
    // 添加avatar字段
    await sequelize.query(`
      ALTER TABLE users 
      ADD COLUMN avatar VARCHAR(255) NULL COMMENT '用户头像URL'
    `);
    
    console.log('avatar字段添加成功');
  } catch (error) {
    if (error.message.includes('Duplicate column name')) {
      console.log('avatar字段已存在');
    } else {
      console.error('添加avatar字段失败:', error.message);
    }
  }
}

addAvatarColumn().then(() => {
  process.exit(0);
});

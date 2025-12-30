-- 添加avatar字段到users表
ALTER TABLE users ADD COLUMN avatar VARCHAR(255) NULL COMMENT '用户头像URL';

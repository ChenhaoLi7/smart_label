const { QueryTypes } = require('sequelize');
const sequelize = require('../config/database');
const axios = require('axios');
const fs = require('fs');
const path = require('path');

// 读取数据库结构作为 Context
const getSchemaContext = () => {
    try {
        const schemaPath = path.join(__dirname, '../../DATABASE_SCHEMA.md');
        if (fs.existsSync(schemaPath)) {
            return fs.readFileSync(schemaPath, 'utf8');
        }
    } catch (error) {
        console.error('Failed to read schema context:', error);
    }
    return '';
};

/**
 * AI Agent Controller
 * 处理自然语言转 SQL 并执行
 */
exports.handleQuery = async (req, res) => {
    try {
        const { prompt } = req.body;

        if (!prompt) {
            return res.status(400).json({ message: '请提供查询内容' });
        }

        const schemaContext = getSchemaContext();

        // LLM 请求设置 - 优先使用环境变量中的配置
        // 默认支持 DeepSeek 或 Ollama (OpenAI 兼容接口)
        const LLM_API_URL = process.env.LLM_API_URL || 'https://api.deepseek.com/chat/completions';
        const LLM_API_KEY = process.env.LLM_API_KEY; // 需要用户在 .env 中设置
        const LLM_MODEL = process.env.LLM_MODEL || 'deepseek-chat';

        const systemMessage = `
你是一个专业的数据库专家。你的任务是将用户的自然语言转换为正确的 MySQL SQL 语句。

数据库结构如下：
${schemaContext}

规则：
1. 只返回 SQL 语句，不要有任何其他解释文字。
2. 始终使用 SELECT 语句进行查询。
3. 如果用户请求删除、更新或修改数据，请拒绝并回复一条以 "ERROR:" 开头的信息。
4. 确保生成的 SQL 语句语法正确且符合 MySQL 规范。
5. 如果 SQL 涉及多个表，请使用正确的 JOIN。

请将以下用户输入转换为 SQL：
`;

        let sql = '';

        try {
            const response = await axios.post(
                LLM_API_URL,
                {
                    model: LLM_MODEL,
                    messages: [
                        { role: 'system', content: systemMessage },
                        { role: 'user', content: prompt }
                    ],
                    temperature: 0.1,
                    stream: false
                },
                {
                    headers: {
                        'Authorization': `Bearer ${LLM_API_KEY}`,
                        'Content-Type': 'application/json'
                    },
                    timeout: 30000
                }
            );

            sql = response.data.choices[0].message.content.trim();

            // 去除 markdown 格式的代码块标记
            sql = sql.replace(/```sql/gi, '').replace(/```/g, '').trim();

            // 如果模型返回了解释性文字，尝试提取 SELECT 语句
            const selectMatch = sql.match(/SELECT[\s\S]*?;/i);
            if (selectMatch) {
                sql = selectMatch[0].trim();
            }

            // 如果还是包含中文或解释性文字，尝试只保留 SQL 部分
            const lines = sql.split('\n');
            const sqlLines = lines.filter(line => {
                const trimmed = line.trim();
                return trimmed &&
                    !trimmed.startsWith('//') &&
                    !trimmed.startsWith('#') &&
                    !/^[\u4e00-\u9fa5]/.test(trimmed); // 不以中文开头
            });

            if (sqlLines.length > 0) {
                sql = sqlLines.join(' ').trim();
            }

        } catch (llmError) {
            console.error('LLM API Error:', llmError.response?.data || llmError.message);
            return res.status(500).json({
                message: 'AI 模型调用失败',
                error: llmError.message,
                tip: '请检查 .env 中的 LLM_API_KEY 和 LLM_API_URL 配置'
            });
        }

        if (sql.startsWith('ERROR:')) {
            return res.status(400).json({ message: sql.replace('ERROR:', '').trim() });
        }

        // 安全检查：只允许 SELECT
        const upperSql = sql.toUpperCase();
        if (!upperSql.startsWith('SELECT') || upperSql.includes('DROP') || upperSql.includes('DELETE') || upperSql.includes('UPDATE') || upperSql.includes('INSERT')) {
            return res.status(403).json({
                message: '出于安全考虑，AI 生成的非查询语句已被拦截',
                generatedSql: sql
            });
        }

        // 执行 SQL
        const results = await sequelize.query(sql, { type: QueryTypes.SELECT });

        res.json({
            success: true,
            sql: sql,
            data: results,
            count: results.length
        });

    } catch (error) {
        console.error('AI Agent Query Error:', error);
        res.status(500).json({ message: '执行失败', error: error.message });
    }
};

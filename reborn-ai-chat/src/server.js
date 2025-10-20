import Anthropic from '@anthropic-ai/sdk';
import { GoogleGenerativeAI } from '@google/generative-ai';
import express from 'express';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Load environment variables
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// Initialize APIs
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const genAI = process.env.GEMINI_API_KEY
  ? new GoogleGenerativeAI(process.env.GEMINI_API_KEY)
  : null;

// Middleware
app.use(express.json());
app.use(express.static(join(__dirname, '../public')));

// System prompt for REBORN AI Assistant
const SYSTEM_PROMPT = `あなたはREBORNプロジェクトの専門AIアシスタントです。

REBORNは、古着（used clothing、ファッション・洋服）をメルカリなどのフリマサイトへ出品する際の、出品時短ツール・在庫管理・売上管理・売上分析などの物販管理システムです。
着物ではなく、洋服（トップス、ボトムス、アウターなど）を扱います。

主な機能：
- 商品登録（52,000件のブランドデータ、AI商品説明文生成）
- 在庫管理
- 売上管理
- プッシュ通知機能
- PWA対応（iPhone/Android）

あなたの役割：
1. REBORNの使い方をサポート
2. 技術的な質問に回答
3. トラブルシューティング
4. 機能改善の提案

丁寧で親しみやすく、かつプロフェッショナルに対応してください。`;

// Chat endpoint with Server-Sent Events (SSE)
app.post('/api/chat', async (req, res) => {
  const { message, useGemini = false } = req.body;

  if (!message) {
    return res.status(400).json({ error: 'Message is required' });
  }

  // Set headers for Server-Sent Events
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  try {
    if (!useGemini && process.env.ANTHROPIC_API_KEY) {
      // Use Claude API
      console.log('🤖 Using Claude API...');

      const stream = await anthropic.messages.stream({
        model: 'claude-3-5-haiku-20241022',
        max_tokens: 4096,
        system: SYSTEM_PROMPT,
        messages: [
          {
            role: 'user',
            content: message
          }
        ],
      });

      stream.on('text', (text) => {
        res.write(`data: ${JSON.stringify({ type: 'text', content: text })}\n\n`);
      });

      stream.on('end', () => {
        res.write(`data: ${JSON.stringify({ type: 'done' })}\n\n`);
        res.end();
      });

      stream.on('error', (error) => {
        console.error('❌ Claude API Error:', error);
        res.write(`data: ${JSON.stringify({ type: 'error', content: error.message })}\n\n`);
        res.end();
      });

    } else if (genAI) {
      // Use Gemini API as fallback
      console.log('🔷 Using Gemini API...');

      const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash-exp' });
      const result = await model.generateContentStream([SYSTEM_PROMPT, message]);

      for await (const chunk of result.stream) {
        const text = chunk.text();
        res.write(`data: ${JSON.stringify({ type: 'text', content: text })}\n\n`);
      }

      res.write(`data: ${JSON.stringify({ type: 'done' })}\n\n`);
      res.end();

    } else {
      throw new Error('No API key configured. Please set ANTHROPIC_API_KEY or GEMINI_API_KEY.');
    }

  } catch (error) {
    console.error('❌ Server Error:', error);
    res.write(`data: ${JSON.stringify({ type: 'error', content: error.message })}\n\n`);
    res.end();
  }
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    apis: {
      claude: !!process.env.ANTHROPIC_API_KEY,
      gemini: !!process.env.GEMINI_API_KEY,
    },
    timestamp: new Date().toISOString(),
  });
});

// Start server
app.listen(PORT, () => {
  console.log('\n🚀 REBORN AI Chat Server');
  console.log(`📡 Server running at http://localhost:${PORT}`);
  console.log('\nAPI Status:');
  console.log(`  Claude API: ${process.env.ANTHROPIC_API_KEY ? '✅ Configured' : '❌ Not configured'}`);
  console.log(`  Gemini API: ${process.env.GEMINI_API_KEY ? '✅ Configured' : '❌ Not configured'}`);
  console.log('\n💡 Open http://localhost:3000 in your browser\n');
});

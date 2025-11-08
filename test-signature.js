/**
 * 固定テストケースでHMAC署名を生成（Node.js版）
 * Cloudflare Workersと同じアルゴリズムで計算
 */

const crypto = require('crypto');

// 固定テストケース（GASと同じ）
const testBody = '{"test":"data","value":123}';
const testTimestamp = '1700000000000';
const secret = 'abc123def456abc123def456abc123def456abc123def456abc123def456abc1';

// メッセージ構築
const message = testTimestamp + '.' + testBody;

// HMAC-SHA256署名生成
const hmac = crypto.createHmac('sha256', secret);
hmac.update(message);
const signatureBuffer = hmac.digest();
const signature = signatureBuffer.toString('hex');

// バイト配列の最初の10バイトを出力
const first10Bytes = [];
for (let i = 0; i < 10; i++) {
  first10Bytes.push(signatureBuffer[i]);
}

console.log('=== 固定テストケース署名検証 ===');
console.log('Body:', testBody);
console.log('Timestamp:', testTimestamp);
console.log('Secret:', secret);
console.log('Message:', message);
console.log('');
console.log('【Node.js first 10 bytes】');
console.log(JSON.stringify(first10Bytes));
console.log('');
console.log('【Node.js (Cloudflare Workers相当) 生成署名】');
console.log(signature);
console.log('');
console.log('【GAS側生成署名（スプレッドシートから）】');
console.log('bbf4cffb82fa7aec37182e1c0a10d881c1366c4058aab434755e8fb522fca61f');
console.log('');
console.log('【比較結果】');
console.log('一致:', signature === 'bbf4cffb82fa7aec37182e1c0a10d881c1366c4058aab434755e8fb522fca61f' ? '✅ YES' : '❌ NO');

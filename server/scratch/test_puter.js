
require('dotenv').config();
const { askPuter } = require('./src/lib/puter');

async function testPuter() {
  console.log('Testing Puter AI Fallback...');
  try {
    const response = await askPuter(
      'You are a helpful assistant.',
      [],
      'Hello! Can you confirm you are working?'
    );
    console.log('✅ Puter Response:', response);
  } catch (err) {
    console.error('❌ Puter Error:', err.message);
  }
}

testPuter();

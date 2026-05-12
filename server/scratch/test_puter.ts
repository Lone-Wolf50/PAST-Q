
import dotenv from 'dotenv';
dotenv.config();
import { askPuter } from '../src/lib/puter';

async function testPuter() {
  console.log('Testing Puter AI Fallback...');
  try {
    const response = await askPuter(
      'You are a helpful assistant.',
      [],
      'Hello! Can you confirm you are working?'
    );
    console.log('✅ Puter Response:', response);
  } catch (err: any) {
    console.error('❌ Puter Error:', err.message);
  }
}

testPuter();

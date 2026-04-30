import express from 'express';
import { GoogleGenAI } from '@google/genai';

const router = express.Router();

// Mock auth middleware for now
const requireAuth = (req: any, res: any, next: any) => {
  // In a real app, verify JWT here
  req.user = { id: 1 }; 
  next();
};

router.post('/chat', requireAuth, async (req, res) => {
  try {
    const { message, history } = req.body;
    
    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
    }

    if (!process.env.GEMINI_API_KEY) {
      return res.status(500).json({ error: 'GEMINI_API_KEY is not configured on the server.' });
    }

    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    
    // Formatting history if provided
    const contents = [];
    if (history && Array.isArray(history)) {
       for (const msg of history) {
           contents.push({ role: msg.role === 'user' ? 'user' : 'model', parts: [{ text: msg.content }] });
       }
    }
    // Add current message
    contents.push({ role: 'user', parts: [{ text: message }] });

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: contents,
      config: {
        systemInstruction: "You are PastQ AI, an expert academic tutor for university students. Explain concepts clearly, concisely, and helpfully."
      }
    });

    res.json({ reply: response.text });
  } catch (error: any) {
    console.error('[AI Chat Error]:', error);
    res.status(500).json({ error: 'Failed to generate AI response.' });
  }
});

export default router;

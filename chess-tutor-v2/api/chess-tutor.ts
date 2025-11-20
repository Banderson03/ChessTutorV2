import type { NextApiRequest, NextApiResponse } from 'next';
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // 1. Get FEN and the CLIENT-SIDE analysis
    const { fen, turn, inCheck, stockfishAnalysis, messages } = req.body;

    // Handle general chat (no position analysis specifically requested)
    if (messages) {
      const completion = await openai.chat.completions.create({
        model: 'gpt-4o-mini', // or gpt-3.5-turbo
        messages: messages,
      });
      return res.status(200).json({ message: completion.choices[0].message.content });
    }

    // Handle "Get Hint" Request
    if (!fen || !turn) {
      return res.status(400).json({ error: 'FEN and turn are required' });
    }

    // 2. Build the prompt using the analysis passed from the client
    const systemPrompt =
      'You are an expert chess tutor who explains concepts clearly to beginners. Focus on the "why" behind moves.';
    
    const userPrompt = `You are a chess tutor helping a beginner.

Current Position (FEN): ${fen}
Turn to move: ${turn === 'w' ? 'White' : 'Black'}
${inCheck ? 'The king is in check!' : ''}

Engine Analysis (Top moves):
${stockfishAnalysis}

Please explain:
1. A brief overview of the position.
2. The best move and why it's good (explain the tactics or strategy).
3. What the opponent might be threatening.

Keep it under 150 words.`;

    // 3. Call OpenAI
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.7,
      max_tokens: 300,
    });

    const explanation = completion.choices[0].message.content;

    res.status(200).json({ message: explanation });
    
  } catch (error) {
    console.error('API route error:', error);
    res.status(500).json({ error: 'Failed to generate analysis' });
  }
}
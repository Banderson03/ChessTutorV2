// For Next.js Pages Router: /pages/api/get-tutor-hint.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import OpenAI from 'openai';
import { Chess } from 'chess.js'; // You'll need chess.js on the server

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

/**
 * Helper function to format UCI moves (e.g., "e2e4") into
 * Standard Algebraic Notation (e.g., "e4") using the current FEN.
 */
function formatMove(fen: string, moveUci: string): string {
  try {
    const gameCopy = new Chess(fen);
    const moveObj = gameCopy.move({
      from: moveUci.slice(0, 2),
      to: moveUci.slice(2, 4),
      promotion: moveUci.length > 4 ? moveUci[4] : undefined,
    });
    // Return the SAN (Standard Algebraic Notation)
    return moveObj ? moveObj.san : moveUci;
  } catch {
    // Fallback to just the UCI move if something goes wrong
    return moveUci;
  }
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // 1. Get the FEN and other game state from the client
    const { fen, turn, inCheck } = req.body;

    if (!fen || !turn) {
      return res.status(400).json({ error: 'FEN and turn are required' });
    }

    // 2. Call the Lichess API to get Stockfish analysis
    const encodedFen = encodeURIComponent(fen);
    const stockfishRes = await fetch(
      `https://lichess.org/api/cloud-eval?fen=${encodedFen}&multiPv=3`,
      {
        headers: {
          // This line tells Lichess you are an authenticated user
          'Authorization': `Bearer ${process.env.LICHESS_API_TOKEN}`
        }
      }
    );

    if (!stockfishRes.ok) {
      // --- ADD THIS LOGGING ---
      // Get the error text from Lichess's response
      const errorText = await stockfishRes.text(); 
      console.error("Lichess API Error:", stockfishRes.status, errorText);
      // --- END LOGGING ---

      // Make our own error more specific
      throw new Error(`Lichess API failed with status: ${stockfishRes.status}`);
    }

    const stockfishData = await stockfishRes.json();

    // 3. Parse the Lichess response to build the moves list
    let formattedMoves = 'No analysis available for this position.';
    if (stockfishData.pvs && stockfishData.pvs.length > 0) {
      formattedMoves = stockfishData.pvs
        .map((pv: any, i: number) => {
          const moveUci = pv.moves.split(' ')[0]; // Get just the first move, e.g., "e2e4"
          const san = formatMove(fen, moveUci);   // Convert "e2e4" to "e4"
          const evalScore = (pv.cp / 100).toFixed(2); // Convert centipawns to decimal
          return `${i + 1}. ${san} (evaluation: ${evalScore})`;
        })
        .join('\n');
    }

    // 4. Build the final prompt for the GenAI
    const systemPrompt =
      'You are an expert chess tutor who explains concepts clearly and concisely to beginners. You focus on the "why" behind moves, comparing strategic approaches.';
    
    const userPrompt = `You are a chess tutor helping a beginner understand their position.

Current Position (FEN): ${fen}
Turn to move: ${turn === 'w' ? 'White' : 'Black'}
${inCheck ? 'The king is in check!' : ''}

Top moves according to analysis:
${formattedMoves}

Please explain:
1. A brief overview of the current position (1-2 sentences).
2. The top 2-3 candidate moves and WHY each is strong (compare offensive vs defensive, tactical vs positional).
3. The main threat or opportunity the player should be thinking about.

Keep it educational but concise (under 200 words).`;

    // 5. Call the OpenAI API
    const completion = await openai.chat.completions.create({
      model: 'gpt-4.1-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.7,
      max_tokens: 300,
    });

    const explanation = completion.choices[0].message.content;

    // 6. Send the final explanation back to the client
    res.status(200).json({ message: explanation });
    
  } catch (error) {
    console.error('API route error:', error);
    res.status(500).json({ error: 'Failed to generate analysis' });
  }
}
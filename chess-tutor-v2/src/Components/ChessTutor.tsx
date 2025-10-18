import React, { useMemo, useState, useEffect } from 'react';
import { Chess } from 'chess.js';
import ChessboardUI from './ChessboardUI';
import ControlsAndAdviceUI from './ControlsAndAdviceUI';


interface TutorSuggestion {
  bestMove: string;
  explanation: string;
}

const ChessTutor: React.FC = () => {
  const game = useMemo(() => new Chess(), []);

  const [fen, setFen] = useState<string>(game.fen());
  const [suggestion, setSuggestion] = useState<string | null>(null);
  const [explanation, setExplanation] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [gameStatus, setGameStatus] = useState<string>("White's turn");

  const updateStatus = () => {
    const turn = game.turn() === 'w' ? 'White' : 'Black';
    if (game.isCheckmate()) setGameStatus(`Checkmate! ${turn === 'White' ? 'Black' : 'White'} wins.`);
    else if (game.isDraw()) setGameStatus('Draw!');
    else setGameStatus(`${turn}'s turn${game.inCheck() ? ' - Check!' : ''}`);
  };
  
  const makeRandomMove = () => {
    const possibleMoves = game.moves();
    if (game.isGameOver() || game.isDraw() || possibleMoves.length === 0) return;
    const move = possibleMoves[Math.floor(Math.random() * possibleMoves.length)];
    game.move(move);
    setFen(game.fen());
    updateStatus();
  };

  const onDrop = (sourceSquare: string, targetSquare: string): boolean => {
    try {
      const move = game.move({ from: sourceSquare, to: targetSquare, promotion: 'q' });
      if (move === null) return false;
      setFen(game.fen());
      updateStatus();
      setTimeout(makeRandomMove, 500);
      return true;
    } catch (error) {
      console.error(error);
      return false;
    }
  };
  
  const resetGame = (): void => {
    game.reset();
    setFen(game.fen());
    setSuggestion(null);
    setExplanation('');
    updateStatus();
  };
  
  const getSuggestion = async (): Promise<void> => {
    if (game.isGameOver()) return;
    setIsLoading(true);
    setSuggestion(null);
    setExplanation('');

    const systemPrompt = `You are a world-class chess tutor for beginners. Analyze a PGN and suggest the best move for the current player. Your explanation should be simple, encouraging, and focus on principles like controlling the center, developing pieces, and king safety. Your response MUST be valid JSON.`;
    const userQuery = `Game PGN: "${game.pgn()}"\nIt's ${game.turn() === 'w' ? "White's" : "Black's"} turn. Provide the best move and a simple explanation.`;
    const apiKey = "";
    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${apiKey}`;
    const payload = {
      contents: [{ parts: [{ text: userQuery }] }],
      systemInstruction: { parts: [{ text: systemPrompt }] },
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: { type: "OBJECT", properties: { bestMove: { type: "STRING" }, explanation: { type: "STRING" } }, required: ["bestMove", "explanation"] }
      }
    };

    try {
      const response = await fetch(apiUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      if (!response.ok) throw new Error(`API request failed with status ${response.status}`);
      const result = await response.json();
      const text = result.candidates?.[0]?.content?.parts?.[0]?.text;
      if (text) {
        const parsedJson: TutorSuggestion = JSON.parse(text);
        setSuggestion(parsedJson.bestMove);
        setExplanation(parsedJson.explanation);
      } else {
        setExplanation("Sorry, I couldn't get a suggestion.");
      }
    } catch (error) {
      console.error("Error fetching suggestion:", error);
      setExplanation("An error occurred. Please check the console.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { updateStatus(); }, []);

  return (
    <div className="flex flex-col lg:flex-row gap-8 w-full">
      <div className="lg:w-1/2">
        <ChessboardUI fen={fen} onDrop={onDrop} gameStatus={gameStatus} />
      </div>
      <div className="lg:w-1/2">
        <ControlsAndAdviceUI getSuggestion={getSuggestion} resetGame={resetGame} isLoading={isLoading} suggestion={suggestion} explanation={explanation} />
      </div>
    </div>
  );
};

export default ChessTutor;
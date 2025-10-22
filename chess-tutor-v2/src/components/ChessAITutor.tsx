import React, { useState, useEffect, useRef } from 'react';
import { Chess } from 'chess.js';

/**
 * Type definitions for our chess tutor
 */
interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
}

interface StockfishMove {
  move: string;
  score: number;
  depth: number;
}

interface ChessAiTutorProps {
  currentFen: string;
  game: Chess;
  onMoveSelect?: (move: string) => void;
}

/**
 * ChessAiTutor Component
 * 
 * Provides AI-powered chess tutoring by:
 * 1. Analyzing positions with Stockfish
 * 2. Getting educational explanations from OpenAI
 * 3. Allowing students to ask questions about chess
 */
export function ChessAiTutor({ currentFen, game, onMoveSelect }: ChessAiTutorProps) {
  // ----------------------------------------------------------------
  // STATE MANAGEMENT
  // ----------------------------------------------------------------
  
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [stockfish, setStockfish] = useState<Worker | null>(null);
  const [topMoves, setTopMoves] = useState<StockfishMove[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);

  // ----------------------------------------------------------------
  // STOCKFISH INITIALIZATION
  // ----------------------------------------------------------------

  useEffect(() => {
    // Initialize Stockfish Web Worker
    // You'll need to have stockfish.js in your public folder
    const sf = new Worker('/stockfish.js');
    
    sf.postMessage('uci');
    
    sf.onmessage = (event) => {
      handleStockfishMessage(event.data);
    };
    
    setStockfish(sf);
    
    return () => {
      sf.terminate();
    };
  }, []);

  // ----------------------------------------------------------------
  // STOCKFISH ANALYSIS
  // ----------------------------------------------------------------

  /**
   * Analyzes the current position and gets top 3-5 moves
   */
  const analyzePosition = async () => {
    if (!stockfish || isAnalyzing) return;
    
    setIsAnalyzing(true);
    const moves: StockfishMove[] = [];
    
    // Request Stockfish to analyze
    stockfish.postMessage(`position fen ${currentFen}`);
    stockfish.postMessage('go depth 15 multipv 5'); // Get top 5 moves
    
    // Wait for analysis to complete (you'll need to implement proper message handling)
    // This is a simplified version
    setTimeout(() => {
      setIsAnalyzing(false);
    }, 3000);
  };

  /**
   * Handles messages from Stockfish worker
   */
  const handleStockfishMessage = (message: string) => {
    // Parse Stockfish output
    if (message.includes('info') && message.includes('pv')) {
      const parts = message.split(' ');
      const pvIndex = parts.indexOf('pv');
      const scoreIndex = parts.indexOf('cp') !== -1 ? parts.indexOf('cp') : parts.indexOf('mate');
      
      if (pvIndex !== -1 && scoreIndex !== -1) {
        const move = parts[pvIndex + 1];
        const score = parseInt(parts[scoreIndex + 1]);
        const depthIndex = parts.indexOf('depth');
        const depth = depthIndex !== -1 ? parseInt(parts[depthIndex + 1]) : 0;
        
        setTopMoves(prev => {
          const existing = prev.find(m => m.move === move);
          if (!existing && prev.length < 5) {
            return [...prev, { move, score, depth }].sort((a, b) => b.score - a.score);
          }
          return prev;
        });
      }
    }
  };

  /**
   * Converts algebraic notation to readable format
   */
  const formatMove = (move: string): string => {
    try {
      const gameCopy = new Chess(currentFen);
      const moveObj = gameCopy.move({
        from: move.slice(0, 2),
        to: move.slice(2, 4),
        promotion: move.length > 4 ? move[4] : undefined
      });
      return moveObj ? moveObj.san : move;
    } catch {
      return move;
    }
  };

  // ----------------------------------------------------------------
  // OPENAI INTEGRATION
  // ----------------------------------------------------------------

  /**
   * Gets AI tutoring explanation for the current position
   */
  const getPositionAnalysis = async () => {
    if (topMoves.length === 0) {
      await analyzePosition();
      // Wait a bit for Stockfish to finish
      await new Promise(resolve => setTimeout(resolve, 3500));
    }

    setIsLoading(true);

    const formattedMoves = topMoves.slice(0, 3).map((m, i) => 
      `${i + 1}. ${formatMove(m.move)} (evaluation: ${(m.score / 100).toFixed(2)})`
    ).join('\n');

    const prompt = `You are a chess tutor helping a beginner understand their position. 

Current Position (FEN): ${currentFen}
Turn to move: ${game.turn() === 'w' ? 'White' : 'Black'}
${game.inCheck() ? 'The king is in check!' : ''}

Top moves according to analysis:
${formattedMoves}

Please explain:
1. A brief overview of the current position (1-2 sentences)
2. The top 2-3 candidate moves and WHY each is strong (compare offensive vs defensive qualities, tactical vs positional)
3. Key things the player should be thinking about

Keep it educational but concise (under 200 words). Focus on teaching concepts, not just listing moves.`;

    try {
      const response = await fetch('/api/chess-tutor', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages: [
            {
              role: 'system',
              content: 'You are an expert chess tutor who explains concepts clearly and concisely to beginners. You focus on the "why" behind moves, comparing strategic approaches.'
            },
            {
              role: 'user',
              content: prompt
            }
          ]
        })
      });

      const data = await response.json();
      const aiResponse = data.message;

      const assistantMessage: Message = {
        role: 'assistant',
        content: aiResponse,
        timestamp: new Date()
      };

      setMessages(prev => [...prev, assistantMessage]);
      setTopMoves([]); // Reset for next analysis
    } catch (error) {
      console.error('Error getting AI response:', error);
      const errorMessage: Message = {
        role: 'assistant',
        content: 'Sorry, I encountered an error analyzing the position. Please try again.',
        timestamp: new Date()
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Handles general chess questions from the user
   */
  const handleUserMessage = async (message: string) => {
    const userMessage: Message = {
      role: 'user',
      content: message,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInputValue('');
    setIsLoading(true);

    try {
      const response = await fetch('/api/chess-tutor', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages: [
            {
              role: 'system',
              content: `You are an expert chess tutor. The current position is: ${currentFen}. The player is ${game.turn() === 'w' ? 'White' : 'Black'} to move. Answer questions clearly and educationally, keeping responses under 150 words unless a detailed explanation is specifically requested.`
            },
            ...messages.slice(-6).map(m => ({ role: m.role, content: m.content })),
            { role: 'user', content: message }
          ]
        })
      });

      const data = await response.json();
      const aiResponse = data.message;

      const assistantMessage: Message = {
        role: 'assistant',
        content: aiResponse,
        timestamp: new Date()
      };

      setMessages(prev => [...prev, assistantMessage]);
    } catch (error) {
      console.error('Error getting AI response:', error);
      const errorMessage: Message = {
        role: 'assistant',
        content: 'Sorry, I encountered an error. Please try again.',
        timestamp: new Date()
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  // ----------------------------------------------------------------
  // UI HANDLERS
  // ----------------------------------------------------------------

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (inputValue.trim() && !isLoading) {
      handleUserMessage(inputValue);
    }
  };

  const handleHintRequest = () => {
    const hintMessage: Message = {
      role: 'user',
      content: '🎯 Requesting position analysis...',
      timestamp: new Date()
    };
    setMessages(prev => [...prev, hintMessage]);
    getPositionAnalysis();
  };

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // ----------------------------------------------------------------
  // RENDER
  // ----------------------------------------------------------------

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h3 style={styles.title}>♟️ Chess Tutor AI</h3>
        <button 
          style={styles.hintButton}
          onClick={handleHintRequest}
          disabled={isLoading || isAnalyzing}
        >
          {isAnalyzing ? 'Analyzing...' : isLoading ? 'Thinking...' : '💡 Get Hint'}
        </button>
      </div>

      <div style={styles.chatContainer} ref={chatContainerRef}>
        {messages.length === 0 && (
          <div style={styles.welcomeMessage}>
            <p>👋 Welcome! I'm your chess tutor.</p>
            <p>Click "Get Hint" to analyze the current position, or ask me any chess questions!</p>
          </div>
        )}
        
        {messages.map((msg, index) => (
          <div
            key={index}
            style={{
              ...styles.message,
              ...(msg.role === 'user' ? styles.userMessage : styles.assistantMessage)
            }}
          >
            <div style={styles.messageHeader}>
              <strong>{msg.role === 'user' ? 'You' : '🤖 Tutor'}</strong>
              <span style={styles.timestamp}>
                {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
            <div style={styles.messageContent}>
              {msg.content}
            </div>
          </div>
        ))}
        
        {isLoading && (
          <div style={styles.loadingIndicator}>
            <div style={styles.typingDot}></div>
            <div style={styles.typingDot}></div>
            <div style={styles.typingDot}></div>
          </div>
        )}
        
        <div ref={messagesEndRef} />
      </div>

      <form onSubmit={handleSendMessage} style={styles.inputForm}>
        <input
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          placeholder="Ask about chess strategies, tactics, openings..."
          style={styles.input}
          disabled={isLoading}
        />
        <button
          type="submit"
          style={styles.sendButton}
          disabled={isLoading || !inputValue.trim()}
        >
          Send
        </button>
      </form>
    </div>
  );
}

// ----------------------------------------------------------------
// STYLING
// ----------------------------------------------------------------

const styles: { [key: string]: React.CSSProperties } = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    width: '100%',
    maxWidth: '500px',
    height: '600px',
    backgroundColor: '#f8f9fa',
    borderRadius: '12px',
    boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
    overflow: 'hidden',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '16px 20px',
    backgroundColor: '#2c3e50',
    color: 'white',
  },
  title: {
    margin: 0,
    fontSize: '1.25rem',
    fontWeight: '600',
  },
  hintButton: {
    padding: '8px 16px',
    fontSize: '0.9rem',
    backgroundColor: '#27ae60',
    color: 'white',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    transition: 'background-color 0.2s',
    fontWeight: '500',
  },
  chatContainer: {
    flex: 1,
    overflowY: 'auto',
    padding: '20px',
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
  },
  welcomeMessage: {
    textAlign: 'center',
    color: '#7f8c8d',
    padding: '40px 20px',
    lineHeight: '1.6',
  },
  message: {
    padding: '12px 16px',
    borderRadius: '12px',
    maxWidth: '85%',
    wordWrap: 'break-word',
    animation: 'fadeIn 0.3s ease-in',
  },
  userMessage: {
    alignSelf: 'flex-end',
    backgroundColor: '#3498db',
    color: 'white',
    marginLeft: 'auto',
  },
  assistantMessage: {
    alignSelf: 'flex-start',
    backgroundColor: 'white',
    color: '#2c3e50',
    border: '1px solid #e0e0e0',
  },
  messageHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    marginBottom: '6px',
    fontSize: '0.85rem',
    opacity: 0.8,
  },
  timestamp: {
    fontSize: '0.75rem',
    fontWeight: 'normal',
  },
  messageContent: {
    lineHeight: '1.5',
    whiteSpace: 'pre-wrap',
  },
  loadingIndicator: {
    display: 'flex',
    gap: '6px',
    padding: '12px 16px',
    alignSelf: 'flex-start',
  },
  typingDot: {
    width: '8px',
    height: '8px',
    backgroundColor: '#95a5a6',
    borderRadius: '50%',
    animation: 'typing 1.4s infinite',
  },
  inputForm: {
    display: 'flex',
    gap: '10px',
    padding: '16px 20px',
    backgroundColor: 'white',
    borderTop: '1px solid #e0e0e0',
  },
  input: {
    flex: 1,
    padding: '12px 16px',
    fontSize: '1rem',
    border: '1px solid #ddd',
    borderRadius: '8px',
    outline: 'none',
  },
  sendButton: {
    padding: '12px 24px',
    fontSize: '1rem',
    backgroundColor: '#3498db',
    color: 'white',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
    fontWeight: '500',
    transition: 'background-color 0.2s',
  },
};

export default ChessAiTutor;
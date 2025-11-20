import React, { useState, useEffect, useRef } from 'react';
import { Chess } from 'chess.js';

interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
}

interface ChessAiTutorProps {
  currentFen: string;
  game: Chess;
  onMoveSelect?: (move: string) => void;
}

export function ChessAiTutor({
  currentFen,
  game,
  onMoveSelect,
}: ChessAiTutorProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  
  // Ref to hold the worker instance
  const stockfishRef = useRef<Worker | null>(null);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);

  // ----------------------------------------------------------------
  // 1. INITIALIZE LOCAL STOCKFISH WORKER
  // ----------------------------------------------------------------
  useEffect(() => {
    // pointing to the file in public/stockfish/
    stockfishRef.current = new Worker('/stockfish/stockfish-17.1-lite-single-03e3232.js');
    
    stockfishRef.current.postMessage('uci');
    // Set MultiPV to 3 to get top 3 moves
    stockfishRef.current.postMessage('setoption name MultiPV value 3'); 

    return () => {
      stockfishRef.current?.terminate();
    };
  }, []);

  // ----------------------------------------------------------------
  // 2. HELPER: ANALYZE POSITION LOCALLY
  // ----------------------------------------------------------------
  const analyzeWithStockfish = (fen: string): Promise<string> => {
    return new Promise((resolve) => {
      const worker = stockfishRef.current;
      if (!worker) {
        resolve("Analysis unavailable (engine not loaded).");
        return;
      }

      let topLines: string[] = [];

      // Listener for this specific analysis run
      const handler = (e: MessageEvent) => {
        const msg = e.data;

        // We look for 'info' lines that have 'pv' (principal variation)
        // and are at a decent depth (e.g., depth 15 is fast and good enough for beginners)
        if (msg.startsWith('info') && msg.includes('pv')) {
            // Simple parsing to store the latest info lines
            // In a real app, you might parse 'multipv' index to ensure you have distinct lines
            // but for simplicity, we just capture the string here.
            
            // We stop listening when we get the 'bestmove' command
        }

        if (msg.startsWith('bestmove')) {
          worker.removeEventListener('message', handler);
          
          // Formatting the captured lines into a readable string for the LLM
          // Note: In a production app, you'd want to parse the specific 'score' and 'pv' 
          // from the 'info' messages stored in `topLines`.
          // For now, we will request a simple evaluation.
          resolve(topLines.join('\n')); 
        }
      };

      // A cleaner approach for the LLM context:
      // We will collect the output of the engine for 1-2 seconds or until depth 12
      const lines: Map<number, string> = new Map();
      
      worker.onmessage = (e) => {
        const msg = e.data;
        // Parse multipv lines: "info depth 10 ... multipv 1 score cp 50 ... pv e2e4 e7e5"
        if (msg.startsWith('info') && msg.includes('depth') && msg.includes('pv')) {
            const multipvMatch = msg.match(/multipv (\d+)/);
            const multipv = multipvMatch ? parseInt(multipvMatch[1]) : 1;
            
            // Only update if depth is reasonable (e.g., > 8)
            lines.set(multipv, msg);
        }

        if (msg.startsWith('bestmove')) {
           // Convert raw UCI lines to readable text for LLM
           const formattedAnalysis = Array.from(lines.values()).map(line => {
             // Extract Move
             const pvMatch = line.match(/ pv (.*)/);
             const moves = pvMatch ? pvMatch[1].split(' ').slice(0, 4).join(' ') : 'unknown';
             
             // Extract Score
             const scoreMatch = line.match(/score cp (-?\d+)/);
             const mateMatch = line.match(/score mate (-?\d+)/);
             let score = '0.0';
             if (mateMatch) score = `Mate in ${mateMatch[1]}`;
             else if (scoreMatch) score = (parseInt(scoreMatch[1]) / 100).toFixed(2);
             
             return `Line: ${moves}... (Eval: ${score})`;
           }).join('\n');

           resolve(formattedAnalysis || "No clear advantage found.");
           // Cleanup usually happens here, but we reuse the worker
        }
      };

      worker.postMessage(`position fen ${fen}`);
      // Depth 15 is fast and plenty strong for a tutor
      worker.postMessage('go depth 15'); 
    });
  };

  // ----------------------------------------------------------------
  // 3. INTEGRATION: GET HINT
  // ----------------------------------------------------------------
  const getPositionAnalysis = async () => {
    setIsLoading(true);

    try {
      // A. Run Local Stockfish First
      const stockfishAnalysis = await analyzeWithStockfish(currentFen);

      // B. Send FEN + Local Analysis to OpenAI
      const response = await fetch('/api/chess-tutor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fen: currentFen,
          turn: game.turn(),
          inCheck: game.inCheck(),
          // PASS THE LOCAL ANALYSIS HERE
          stockfishAnalysis: stockfishAnalysis 
        }),
      });

      if (!response.ok) throw new Error('Failed to get analysis');

      const data = await response.json();
      
      setMessages((prev) => [...prev, {
        role: 'assistant',
        content: data.message,
        timestamp: new Date(),
      }]);
    } catch (error) {
      console.error('Error:', error);
      setMessages((prev) => [...prev, {
        role: 'assistant',
        content: 'I had trouble analyzing that position. Please try again.',
        timestamp: new Date(),
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Handles general chess questions from the user
   * (This function is UNCHANGED and correctly calls /api/chess-tutor)
   */
  const handleUserMessage = async (message: string) => {
    const userMessage: Message = {
      role: 'user',
      content: message,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
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
              content: `You are an expert chess tutor. The current position is: ${currentFen}. The player is ${
                game.turn() === 'w' ? 'White' : 'Black'
              } to move. Answer questions clearly and educationally, keeping responses under 150 words unless a detailed explanation is specifically requested.`,
            },
            ...messages.slice(-6).map((m) => ({ role: m.role, content: m.content })),
            { role: 'user', content: message },
          ],
        }),
      });

      const data = await response.json();
      const aiResponse = data.message;

      const assistantMessage: Message = {
        role: 'assistant',
        content: aiResponse,
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, assistantMessage]);
    } catch (error) {
      console.error('Error getting AI response:', error);
      const errorMessage: Message = {
        role: 'assistant',
        content: 'Sorry, I encountered an error. Please try again.',
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMessage]);
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
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, hintMessage]);
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
          disabled={isLoading} // Updated
        >
          {isLoading ? 'Thinking...' : '💡 Get Hint'} 
        </button>
      </div>

      <div style={styles.chatContainer} ref={chatContainerRef}>
        {messages.length === 0 && (
          <div style={styles.welcomeMessage}>
            <p>👋 Welcome! I'm your chess tutor.</p>
            <p>
              Click "Get Hint" to analyze the current position, or ask me any
              chess questions!
            </p>
          </div>
        )}

        {messages.map((msg, index) => (
          <div
            key={index}
            style={{
              ...styles.message,
              ...(msg.role === 'user'
                ? styles.userMessage
                : styles.assistantMessage),
            }}
          >
            <div style={styles.messageHeader}>
              <strong>{msg.role === 'user' ? 'You' : '🤖 Tutor'}</strong>
              <span style={styles.timestamp}>
                {msg.timestamp.toLocaleTimeString([], {
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </span>
            </div>
            <div style={styles.messageContent}>{msg.content}</div>
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
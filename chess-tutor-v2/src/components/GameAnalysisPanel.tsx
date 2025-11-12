import React, { useState } from 'react';
import { Chess } from 'chess.js';

/**
 * Type definitions for game analysis
 */
interface GameAnalysis {
  moveNumber: number;        // Which move in the game (1, 2, 3, etc.)
  move: string;              // The move in SAN notation (e.g., "Nf3", "e4")
  fen: string;               // Position after this move
  evaluation: number;        // Centipawn evaluation (100 = 1 pawn advantage)
  classification: 'brilliant' | 'great' | 'good' | 'inaccuracy' | 'mistake' | 'blunder' | 'book';
  comment?: string;          // Optional comment about the move
}

interface GameAnalysisPanelProps {
  moves: string[];
  onClose?: () => void;
}

export function GameAnalysisPanel({ moves, onClose }: GameAnalysisPanelProps) {
  const [analysis, setAnalysis] = useState<GameAnalysis[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [gameSummary, setGameSummary] = useState<string>('');

  /**
   * Analyzes the game using the provided move list
   */
  const analyzeGame = async () => {
    setIsAnalyzing(true);
    
    // Reconstruct the game from the move list
    const replayGame = new Chess();
    const analysisResults: GameAnalysis[] = [];
    
    for (let i = 0; i < moves.length; i++) {
      const moveSan = moves[i];
      
      // Get position before move
      const fenBefore = replayGame.fen();
      
      try {
        // Analyze position before the move
        const response = await fetch(
          `https://lichess.org/api/cloud-eval?fen=${encodeURIComponent(fenBefore)}&multiPv=1`
        );
        const data = await response.json();
        
        const evalBefore = data.pvs?.[0]?.cp || 0;
        const bestMoveUci = data.pvs?.[0]?.moves.split(' ')[0];
        
        // Make the actual move that was played
        const moveResult = replayGame.move(moveSan);
        
        if (!moveResult) {
          console.error('Invalid move in history:', moveSan);
          continue;
        }
        
        // Get evaluation after move
        const fenAfter = replayGame.fen();
        const responseAfter = await fetch(
          `https://lichess.org/api/cloud-eval?fen=${encodeURIComponent(fenAfter)}&multiPv=1`
        );
        const dataAfter = await responseAfter.json();
        const evalAfter = dataAfter.pvs?.[0]?.cp || 0;
        
        // Calculate evaluation loss (from the perspective of who just moved)
        const perspective = moveResult.color === 'w' ? 1 : -1;
        const evalChange = (evalAfter - evalBefore) * perspective;
        
        // Classify the move
        let classification: GameAnalysis['classification'] = 'good';
        const actualMoveUci = moveResult.from + moveResult.to + (moveResult.promotion || '');
        
        if (bestMoveUci === actualMoveUci) {
          classification = 'brilliant';
        } else if (evalChange >= -10) {
          classification = 'great';
        } else if (evalChange >= -40) {
          classification = 'good';
        } else if (evalChange >= -100) {
          classification = 'inaccuracy';
        } else if (evalChange >= -200) {
          classification = 'mistake';
        } else {
          classification = 'blunder';
        }
        
        analysisResults.push({
          moveNumber: Math.floor(i / 2) + 1,
          move: moveSan,
          fen: fenAfter,
          evaluation: evalAfter,
          classification,
          comment: evalChange < -100 ? `Lost ${Math.abs(Math.round(evalChange / 100))} pawns of advantage` : undefined
        });
        
        // Rate limiting
        await new Promise(resolve => setTimeout(resolve, 300));
        
      } catch (error) {
        console.error('Error analyzing move:', error);
        // Add move without analysis if API fails
        const moveResult = replayGame.history({ verbose: true }).pop();
        if (moveResult) {
          analysisResults.push({
            moveNumber: Math.floor(i / 2) + 1,
            move: moveSan,
            fen: replayGame.fen(),
            evaluation: 0,
            classification: 'good',
          });
        }
      }
    }
    
    setAnalysis(analysisResults);
    setIsAnalyzing(false);
    
    // Get AI summary after analysis completes
    await getGameSummary(analysisResults, moves);
  };

  const getGameSummary = async (analysisData: GameAnalysis[], moveList: string[]) => {
    // Create a game to check result
    const resultGame = new Chess();
    moveList.forEach(move => resultGame.move(move));
    
    const mistakes = analysisData.filter(a => a.classification === 'mistake').length;
    const blunders = analysisData.filter(a => a.classification === 'blunder').length;
    const inaccuracies = analysisData.filter(a => a.classification === 'inaccuracy').length;

    const result = resultGame.isCheckmate() 
      ? `Checkmate - ${resultGame.turn() === 'w' ? 'Black' : 'White'} wins`
      : resultGame.isDraw() 
      ? 'Draw'
      : 'Game Over';
    
    const prompt = `Analyze this chess game summary:
    
Result: ${result}
Total Moves: ${analysisData.length}
Inaccuracies: ${inaccuracies}
Mistakes: ${mistakes}
Blunders: ${blunders}

Key moments:
${analysisData
  .filter(a => ['mistake', 'blunder', 'brilliant'].includes(a.classification))
  .slice(0, 5)
  .map(a => `Move ${a.moveNumber}: ${a.move} (${a.classification})${a.comment ? ' - ' + a.comment : ''}`)
  .join('\n')}

Provide a brief 3-4 sentence summary of the player's performance and 2-3 key areas to improve. Be encouraging but honest.`;

    try {
      const response = await fetch('/api/chess-tutor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [
            { role: 'system', content: 'You are a supportive chess coach providing constructive game analysis to beginners.' },
            { role: 'user', content: prompt }
          ]
        })
      });
      
      const data = await response.json();
      setGameSummary(data.message);
    } catch (error) {
      console.error('Error getting game summary:', error);
    }
  };

  const getMoveColor = (classification: GameAnalysis['classification']) => {
    const colors = {
      brilliant: '#1abc9c',
      great: '#2ecc71',
      good: '#95a5a6',
      inaccuracy: '#f39c12',
      mistake: '#e67e22',
      blunder: '#e74c3c',
      book: '#3498db',
    };
    return colors[classification];
  };

  const getMoveIcon = (classification: GameAnalysis['classification']) => {
    const icons = {
      brilliant: '!!',
      great: '!',
      good: '',
      inaccuracy: '?!',
      mistake: '?',
      blunder: '??',
      book: '📖',
    };
    return icons[classification];
  };

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h3>📊 Game Analysis</h3>
        {onClose && (
          <button onClick={onClose} style={styles.closeButton}>
            ✕
          </button>
        )}
      </div>
      
      {!isAnalyzing && analysis.length === 0 && (
        <div style={styles.startContainer}>
          <p style={styles.description}>
            Analyze your completed game to see which moves were brilliant, good, or could be improved.
          </p>
          <button onClick={analyzeGame} style={styles.analyzeButton}>
            Start Analysis
          </button>
        </div>
      )}
      
      {isAnalyzing && (
        <div style={styles.loading}>
            <div style={styles.loadingSpinner}></div>
            <p>Analyzing game... This may take a minute.</p>
            <p style={styles.loadingSubtext}>Analyzing {analysis.length} / {moves.length} moves</p>        </div>
      )}
      
      {analysis.length > 0 && !isAnalyzing && (
        <div style={styles.analysisContainer}>
          {gameSummary && (
            <div style={styles.summary}>
              <h4>🎓 Coach's Summary</h4>
              <p style={styles.summaryText}>{gameSummary}</p>
            </div>
          )}
          
          <div style={styles.stats}>
            <div style={styles.statItem}>
              <span style={styles.statIcon}>✨</span>
              <div>
                <div style={styles.statNumber}>
                  {analysis.filter(a => ['brilliant', 'great'].includes(a.classification)).length}
                </div>
                <div style={styles.statLabel}>Great Moves</div>
              </div>
            </div>
            <div style={styles.statItem}>
              <span style={styles.statIcon}>⚠️</span>
              <div>
                <div style={styles.statNumber}>
                  {analysis.filter(a => a.classification === 'inaccuracy').length}
                </div>
                <div style={styles.statLabel}>Inaccuracies</div>
              </div>
            </div>
            <div style={styles.statItem}>
              <span style={styles.statIcon}>❌</span>
              <div>
                <div style={styles.statNumber}>
                  {analysis.filter(a => ['mistake', 'blunder'].includes(a.classification)).length}
                </div>
                <div style={styles.statLabel}>Mistakes</div>
              </div>
            </div>
          </div>
          
          <h4 style={styles.moveListTitle}>Move by Move</h4>
          <div style={styles.moveList}>
            {analysis.map((moveAnalysis, index) => (
              <div
                key={index}
                style={{
                  ...styles.moveItem,
                  borderLeft: `4px solid ${getMoveColor(moveAnalysis.classification)}`,
                }}
              >
                <span style={styles.moveNumber}>
                  {moveAnalysis.moveNumber}.
                </span>
                <span style={styles.moveSan}>
                  {moveAnalysis.move}
                  <span style={styles.moveIcon}>
                    {getMoveIcon(moveAnalysis.classification)}
                  </span>
                </span>
                <span 
                  style={{
                    ...styles.classification,
                    color: getMoveColor(moveAnalysis.classification)
                  }}
                >
                  {moveAnalysis.classification}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

const styles: { [key: string]: React.CSSProperties } = {
  container: {
    padding: '20px',
    backgroundColor: '#f8f9fa',
    borderRadius: '12px',
    maxWidth: '600px',
    boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '20px',
  },
  closeButton: {
    background: 'none',
    border: 'none',
    fontSize: '1.5rem',
    cursor: 'pointer',
    color: '#7f8c8d',
  },
  startContainer: {
    textAlign: 'center',
    padding: '40px 20px',
  },
  description: {
    color: '#7f8c8d',
    marginBottom: '20px',
    lineHeight: '1.6',
  },
  analyzeButton: {
    padding: '12px 24px',
    backgroundColor: '#3498db',
    color: 'white',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '1rem',
    fontWeight: '500',
  },
  loading: {
    textAlign: 'center',
    padding: '40px 20px',
    color: '#7f8c8d',
  },
  loadingSpinner: {
    width: '40px',
    height: '40px',
    border: '4px solid #ecf0f1',
    borderTop: '4px solid #3498db',
    borderRadius: '50%',
    animation: 'spin 1s linear infinite',
    margin: '0 auto 20px',
  },
  loadingSubtext: {
    fontSize: '0.9rem',
    marginTop: '10px',
  },
  analysisContainer: {
    marginTop: '20px',
  },
  summary: {
    backgroundColor: 'white',
    padding: '20px',
    borderRadius: '8px',
    marginBottom: '20px',
    borderLeft: '4px solid #3498db',
  },
  summaryText: {
    lineHeight: '1.6',
    color: '#2c3e50',
  },
  stats: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: '15px',
    marginBottom: '25px',
  },
  statItem: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    padding: '15px',
    backgroundColor: 'white',
    borderRadius: '8px',
    textAlign: 'center',
  },
  statIcon: {
    fontSize: '2rem',
    marginBottom: '10px',
  },
  statNumber: {
    fontSize: '1.75rem',
    fontWeight: 'bold',
    color: '#2c3e50',
  },
  statLabel: {
    fontSize: '0.85rem',
    color: '#7f8c8d',
    marginTop: '5px',
  },
  moveListTitle: {
    marginBottom: '15px',
    color: '#2c3e50',
  },
  moveList: {
    maxHeight: '400px',
    overflowY: 'auto',
  },
  moveItem: {
    display: 'flex',
    gap: '12px',
    padding: '12px',
    backgroundColor: 'white',
    marginBottom: '8px',
    borderRadius: '6px',
    alignItems: 'center',
  },
  moveNumber: {
    fontWeight: 'bold',
    minWidth: '35px',
    color: '#7f8c8d',
  },
  moveSan: {
    flex: 1,
    fontFamily: 'monospace',
    fontSize: '1.1rem',
    fontWeight: '500',
  },
  moveIcon: {
    marginLeft: '8px',
    color: '#e74c3c',
  },
  classification: {
    fontSize: '0.85rem',
    textTransform: 'capitalize',
    padding: '4px 10px',
    borderRadius: '4px',
    backgroundColor: '#ecf0f1',
    fontWeight: '500',
  },
};

export default GameAnalysisPanel;
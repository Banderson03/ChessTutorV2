import React, { useState, useEffect, useCallback } from 'react';
import { Chessboard } from 'react-chessboard';
import { Chess, Move } from 'chess.js'; // Logic, state, and type import
// @ts-ignore: no type declarations available for 'js-chess-engine'
import { Game as AiGame } from 'js-chess-engine'; // The AI engine
import '../App.css'; // Import the CSS file

interface ChessTutorGameProps {
  game: Chess;
  setGame: (game: Chess) => void;
  fen: string;
  setFen: (fen: string) => void;
  actualMovesPlayed: string[];
  setActualMovesPlayed: React.Dispatch<React.SetStateAction<string[]>>;
  onGameComplete?: (moves: string[]) => void;
}

/**
 * A complete, self-contained chess tutor component.
 * It integrates react-chessboard (UI), chess.js (logic),
 * and js-chess-engine (AI) to provide all the requested features.
 */
export function ChessTutorGame({
  game,
  setGame,
  fen,
  setFen,
  actualMovesPlayed,
  setActualMovesPlayed,
  onGameComplete
}: ChessTutorGameProps) {
  // ----------------------------------------------------------------
  // STATE MANAGEMENT
  // ----------------------------------------------------------------

  // The player's current color. 'w' or 'b'.
  const [playerColor, setPlayerColor] = useState<'w' | 'b'>('w');

  // The AI's difficulty level (0-4 for js-chess-engine).
  const [difficulty, setDifficulty] = useState(0);

  // A stack to hold moves that have been undone, for the 'Redo' feature.
  const [redoStack, setRedoStack] = useState<string[]>([]);

  // Add this to your state declarations at the top
  const [fenHistory, setFenHistory] = useState<string[]>([game.fen()]);

  // Move highlighting state
  const [moveFrom, setMoveFrom] = useState('');
  const [optionSquares, setOptionSquares] = useState<Record<string, React.CSSProperties>>({});

  // Toggle for AI opponent
  const [isAiEnabled, setIsAiEnabled] = useState(true);

  // ----------------------------------------------------------------
  // CORE GAME LOGIC
  // ----------------------------------------------------------------

  /**
   * This function is called when it's the AI's turn to move.
   */
  const makeAiMove = useCallback(() => {
    const aiGame = new AiGame(game.fen());
    const aiMoveObject = aiGame.aiMove(difficulty);

    if (!aiMoveObject || Object.keys(aiMoveObject).length === 0) {
      console.warn("AI returned no move. Game is likely over.");
      return;
    }

    const fromSquare = Object.keys(aiMoveObject)[0];
    const toSquare = aiMoveObject[fromSquare];

    if (!fromSquare || !toSquare) {
      console.error("AI returned an invalid/malformed move:", aiMoveObject);
      return;
    }

    const moveForChessJs = {
      from: fromSquare.toLowerCase(),
      to: toSquare.toLowerCase(),
      promotion: 'q',
    };

    const gameCopy = new Chess(game.fen());
    try {
      const moveResult = gameCopy.move(moveForChessJs);

      if (moveResult) {
        setGame(gameCopy);
        setFen(gameCopy.fen());
        setFenHistory(prev => [...prev, gameCopy.fen()]);
        setRedoStack([]);
        setActualMovesPlayed(prev => [...prev, moveResult.san]);
      }
    } catch (e) {
      console.error("AI move failed or was illegal:", moveForChessJs, e);
    }
  }, [game, difficulty, setActualMovesPlayed]);

  /**
   * Main game loop for AI moves.
   */
  useEffect(() => {
    if (game.isGameOver()) {
      if (onGameComplete) {
        onGameComplete(actualMovesPlayed);
      }
      return;
    }

    if (!game.isGameOver() && game.turn() !== playerColor && isAiEnabled) {
      const timer = setTimeout(() => {
        makeAiMove();
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [fen, playerColor, game, makeAiMove, onGameComplete, actualMovesPlayed, isAiEnabled]);

  /**
   * Get the move options for a square to show valid moves
   */
  function getMoveOptions(square: string) {
    const moves = game.moves({
      square: square as any,
      verbose: true
    });

    if (moves.length === 0) {
      setOptionSquares({});
      return false;
    }

    const newSquares: Record<string, React.CSSProperties> = {};
    moves.map((move) => {
      newSquares[move.to] = {
        background:
          game.get(move.to as any) && game.get(move.to as any)?.color !== game.get(square as any)?.color
            ? 'radial-gradient(circle, rgba(0,0,0,.1) 85%, transparent 85%)'
            : 'radial-gradient(circle, rgba(0,0,0,.1) 25%, transparent 25%)',
        borderRadius: '50%',
      };
      return move;
    });

    newSquares[square] = {
      background: 'rgba(255, 255, 0, 0.4)',
    };

    setOptionSquares(newSquares);
    return true;
  }

  /**
   * Handles square click for move highlighting and click-to-move
   */
  function onSquareClick({ square }: { square: string }) {
    // If AI is enabled and it's not player's turn, block interaction
    if (isAiEnabled && game.turn() !== playerColor) {
      return;
    }

    // If we have a piece selected (moveFrom) and click another square
    if (!moveFrom) {
      // We are selecting a piece
      const hasMoveOptions = getMoveOptions(square);
      if (hasMoveOptions) setMoveFrom(square);
      return;
    }

    // We have a piece selected, and we clicked a target square
    // 1. Attempt to move
    const gameCopy = new Chess(game.fen());
    try {
      const move = gameCopy.move({
        from: moveFrom,
        to: square,
        promotion: 'q', // always promote to queen for simplicity
      });

      // If move is valid
      if (move) {
        setGame(gameCopy);
        setFen(gameCopy.fen());
        setFenHistory(prev => [...prev, gameCopy.fen()]);
        setRedoStack([]);
        setActualMovesPlayed(prev => [...prev, move.san]);

        // Clear highlights
        setMoveFrom('');
        setOptionSquares({});
        return;
      }
    } catch (e) {
      // Invalid move or error
    }

    // 2. If move failed, check if we clicked on a different piece of our own to switch selection
    const hasMoveOptions = getMoveOptions(square);
    if (hasMoveOptions) {
      setMoveFrom(square);
    } else {
      // Clicked on empty square or invalid spot, clear selection
      setMoveFrom('');
      setOptionSquares({});
    }
  }

  /**
   * Handles piece drop
   */
  function onPieceDrop(sourceSquare: string, targetSquare: string): boolean {
    // If AI is enabled and it's not player's turn, block move
    if (isAiEnabled && game.turn() !== playerColor) {
      return false;
    }

    const gameCopy = new Chess(game.fen());
    try {
      const move = gameCopy.move({
        from: sourceSquare,
        to: targetSquare,
        promotion: 'q',
      });

      if (move === null) {
        return false;
      }

      setGame(gameCopy);
      setFen(gameCopy.fen());
      setFenHistory(prev => [...prev, gameCopy.fen()]);
      setRedoStack([]);
      setActualMovesPlayed(prev => [...prev, move.san]);

      // Clear highlights on drop
      setMoveFrom('');
      setOptionSquares({});

      return true;
    } catch (e) {
      return false;
    }
  }

  // ----------------------------------------------------------------
  // FEATURE HANDLERS (BUTTONS, ETC.)
  // ----------------------------------------------------------------

  function handleNewGame() {
    const newGame = new Chess();
    setGame(newGame);
    setFen(newGame.fen());
    setPlayerColor('w');
    setRedoStack([]);
    setFenHistory([newGame.fen()]);
    setActualMovesPlayed([]);
  }

  function handleUndo() {
    if (fenHistory.length <= 2) return;

    const previousFen = fenHistory[fenHistory.length - 3];
    const newGame = new Chess(previousFen);

    const movedUndone = [
      fenHistory[fenHistory.length - 1], // AI move
      fenHistory[fenHistory.length - 2], // Player move
    ];

    setRedoStack(prev => [...movedUndone, ...prev]);
    setFenHistory(prev => prev.slice(0, -2));
    setGame(newGame);
    setFen(previousFen);
  }

  function handleRedo() {
    if (redoStack.length < 2) return;

    const [aiMove, playerMove, ...remainingStack] = redoStack;
    const newGame = new Chess(aiMove);

    setGame(newGame);
    setFen(aiMove);
    setFenHistory(prev => [...prev, playerMove, aiMove]);
    setRedoStack(remainingStack);
  }

  function handleSwapSides() {
    setPlayerColor(playerColor === 'w' ? 'b' : 'w');
  }

  // ----------------------------------------------------------------
  // HELPER / STATUS FUNCTIONS
  // ----------------------------------------------------------------

  function getGameStatus(): string {
    if (game.isCheckmate()) {
      return `Checkmate! ${game.turn() === 'w' ? 'Black' : 'White'} wins.`;
    }
    if (game.isDraw()) {
      return 'Game is a draw.';
    }
    if (game.isStalemate()) {
      return 'Stalemate.';
    }
    if (game.inCheck()) {
      return `Check! ${game.turn() === 'w' ? 'White' : 'Black'} to move.`;
    }
    return `${game.turn() === 'w' ? 'White' : 'Black'} to move.`;
  }

  // ----------------------------------------------------------------
  // RENDER (JSX)
  // ----------------------------------------------------------------

  const statusColor = game.isCheckmate() ? 'green' : game.isStalemate() ? 'yellow' : game.inCheck() ? 'red' : game.turn() === 'w' ? 'white' : game.turn() === 'b' ? 'black' : 'white';

  return (
    <div style={styles.container}>

      {/* The Control Panel */}
      <div style={styles.controlsContainer}>
        <div style={styles.statusCard} >
          <h2 style={{ ...styles.status, color: statusColor }}>{getGameStatus()}</h2>
        </div>
        <div style={styles.fenContainer}>
          <label style={styles.label}>Current FEN:</label>
          <div style={styles.fenDisplay}>
            {fen}
          </div>
        </div>

        <div style={styles.buttonGroup}>
          <button
            className="chess-btn chess-btn-primary"
            onClick={handleUndo}
            disabled={fenHistory.length <= 2}
          >
            Undo
          </button>
          <button
            className="chess-btn chess-btn-primary"
            onClick={handleRedo}
            disabled={redoStack.length === 0}
          >
            Redo
          </button>
          <button className="chess-btn chess-btn-primary" onClick={handleNewGame}>
            New Game
          </button>
          <button className="chess-btn chess-btn-primary" onClick={handleSwapSides}>
            Swap Sides<br></br>(Play as {playerColor === 'w' ? 'Black' : 'White'})
          </button>
        </div>

        <div style={styles.difficultyControl}>
          <div style={styles.toggleContainer}>
            <label style={styles.label}>AI Opponent:</label>
            <button
              className="chess-btn chess-toggle-btn"
              style={{
                backgroundColor: isAiEnabled ? '#27ae60' : '#95a5a6',
              }}
              onClick={() => setIsAiEnabled(!isAiEnabled)}
            >
              {isAiEnabled ? 'ON' : 'OFF'}
            </button>
          </div>

          {isAiEnabled && (
            <>
              <label style={styles.label}>AI Difficulty:</label>
              <div style={styles.segmentedControl}>
                {[0, 1, 2, 3, 4].map((level) => (
                  <button
                    key={level}
                    className="chess-btn chess-segment-btn"
                    style={{
                      backgroundColor: difficulty === level ? '#b58863' : '#e0e0e0',
                      color: difficulty === level ? 'white' : '#333',
                    }}
                    onClick={() => setDifficulty(level)}
                  >
                    {level}
                  </button>
                ))}
              </div>
              <div style={styles.difficultyLabel}>
                {['Beginner', 'Easy', 'Medium', 'Hard', 'Expert'][difficulty]}
              </div>
            </>
          )}
        </div>

      </div>

      {/* The Chessboard UI Component */}
      <div style={styles.boardContainer}>
        <Chessboard
          options={{
            id: "ChessTutorBoard",
            position: fen,
            onPieceDrop: ({ sourceSquare, targetSquare }) => {
              if (!sourceSquare || !targetSquare) return false;
              return onPieceDrop(sourceSquare, targetSquare);
            },
            // Flip the board when the player swaps sides. chessboard expects
            // the strings "white" or "black"; our state uses 'w'|'b'.
            boardOrientation: playerColor === 'w' ? 'white' : 'black',
            squareStyles: optionSquares,
            onSquareClick: onSquareClick,
          }}
        />
      </div>
    </div>
  );
}

// ----------------------------------------------------------------
// STYLING
// ----------------------------------------------------------------

const styles: { [key: string]: React.CSSProperties } = {
  container: {
    display: 'flex',
    flexDirection: 'row',
    fontFamily: 'sans-serif',
    gap: '20px',
    alignItems: 'flex-start',
  },
  boardContainer: {
    width: '600px',
    maxWidth: '90vw',
    backgroundColor: '#4e3a2b',
    padding: '20px',
    borderRadius: '12px',
    flexShrink: 0,
  },
  controlsContainer: {
    width: '410px',
    display: 'flex',
    flexDirection: 'column',
    gap: '40px',
    flexShrink: 0,
    padding: '20px',
    backgroundColor: '#4e3a2b',
    borderRadius: '12px',
    minHeight: '600px',
    maxHeight: '600px',
  },
  status: {
    fontSize: '1.3rem',
    fontWeight: 'bold',
    textAlign: 'center',
    minHeight: '30px',
  },
  buttonGroup: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '12px',
  },
  difficultyControl: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  label: {
    fontSize: '1rem',
    fontWeight: '600',
    color: '#f0d9b5',
  },
  statusCard: {
    backgroundColor: 'rgba(0, 0, 0, 0.2)',
    borderRadius: '8px',
    marginBottom: '-20px',
    padding: '10px',
    border: '1px solid rgba(255, 255, 255, 0.1)',
  },
  toggleContainer: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '5px',
    backgroundColor: 'rgba(0, 0, 0, 0.2)',
    padding: '8px 12px',
    borderRadius: '8px',
    marginTop: '-5px',
  },
  segmentedControl: {
    display: 'flex',
    gap: '4px',
  },
  difficultyLabel: {
    textAlign: 'center',
    fontSize: '0.9rem',
    color: '#f0d9b5',
    marginTop: '8px',
    fontWeight: '500',
  },
  fenContainer: {
    // marginTop: 'auto',
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  fenDisplay: {
    backgroundColor: 'rgba(0, 0, 0, 0.2)',
    padding: '8px',
    borderRadius: '6px',
    color: '#f0d9b5',
    fontSize: '0.68rem',
    fontFamily: 'monospace',
    wordBreak: 'break-all',
    border: '1px solid rgba(255, 255, 255, 0.1)',
  }
};

export default ChessTutorGame;
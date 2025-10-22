import React, { useState, useEffect, useCallback } from 'react';
import { Chessboard } from 'react-chessboard';
import { Chess, Move } from 'chess.js'; // Logic, state, and type import
// @ts-ignore: no type declarations available for 'js-chess-engine'
import { Game as AiGame } from 'js-chess-engine'; // The AI engine

/**
 * A complete, self-contained chess tutor component.
 * It integrates react-chessboard (UI), chess.js (logic),
 * and js-chess-engine (AI) to provide all the requested features.
 */
export function ChessTutorGame() {
  // ----------------------------------------------------------------
  // STATE MANAGEMENT
  // ----------------------------------------------------------------

  // Main game state from chess.js. Used for logic, validation, and history.
  const [game, setGame] = useState(new Chess());

  // Current FEN string. This is what react-chessboard actually displays.
  // We keep this separate from 'game' to trigger re-renders properly.
  const [fen, setFen] = useState(game.fen());

  // The player's current color. 'w' or 'b'.
  const [playerColor, setPlayerColor] = useState<'w' | 'b'>('w');

  // The AI's difficulty level (0-4 for js-chess-engine).
  const [difficulty, setDifficulty] = useState(0);

  // A stack to hold moves that have been undone, for the 'Redo' feature.
  const [redoStack, setRedoStack] = useState<string[]>([]);

  // Add this to your state declarations at the top
  const [fenHistory, setFenHistory] = useState<string[]>([game.fen()]);

  // ----------------------------------------------------------------
  // CORE GAME LOGIC
  // ----------------------------------------------------------------

  /**
   * This function is called when it's the AI's turn to move.
   * It uses js-chess-engine to calculate a move based on the
   * current difficulty and FEN.
   */
  const makeAiMove = useCallback(() => {
    // 1. Create a new AI game instance using the current FEN.
    const aiGame = new AiGame(game.fen());

    // 2. Get the AI's move. This might be {'g8': 'f6'}, {}, or null.
    const aiMoveObject = aiGame.aiMove(difficulty);

    // ----------------------------------------------------------------
    // --- THIS IS THE FIX (V4 - Robust Check) ---
    // ----------------------------------------------------------------

    // 1. Check if the move object itself is valid
    if (!aiMoveObject || Object.keys(aiMoveObject).length === 0) {
      console.warn("AI returned no move. Game is likely over.");
      return; // Stop if no move was found
    }

    // 2. Extract the 'from' and 'to' squares
    const fromSquare = Object.keys(aiMoveObject)[0];
    const toSquare = aiMoveObject[fromSquare];

    // 3. Check if *both* squares are valid strings before calling .toLowerCase()
    if (!fromSquare || !toSquare) {
      console.error("AI returned an invalid/malformed move:", aiMoveObject);
      return; // Stop if the move object is malformed
    }
    // ----------------------------------------------------------------
    // --- END FIX ---
    // ----------------------------------------------------------------

    // 4. Now we are safe. Create the move object for chess.js.
    const moveForChessJs = {
      from: fromSquare.toLowerCase(),
      to: toSquare.toLowerCase(),
      promotion: 'q', // Always promote to queen for simplicity
    };

    // 5. Apply this move to our main chess.js instance.
    const gameCopy = new Chess(game.fen());
    const moveResult = gameCopy.move(moveForChessJs);

    if (moveResult) {
      // 6. Update our game state and FEN.
      setGame(gameCopy);
      setFen(gameCopy.fen());
      setFenHistory(prev => [...prev, gameCopy.fen()]);
      setRedoStack([]);
    } else {
      // This should not happen now, but it's a good safety log.
      console.error(
        "AI move was rejected by chess.js as invalid:",
        moveForChessJs
      );
    }
  }, [game, difficulty]);

  /**
   * This useEffect hook is the main game loop.
   * It runs whenever the FEN or playerColor changes.
   * It checks if it's the AI's turn and, if so, triggers its move.
   */
  useEffect(() => {
    // Is the game still going, AND is it the AI's turn?
    if (!game.isGameOver() && game.turn() !== playerColor) {
      // Add a slight delay for a more natural feel.
      const timer = setTimeout(() => {
        makeAiMove();
      }, 500); // 0.5 second delay

      // Cleanup function to clear the timer if the component unmounts.
      return () => clearTimeout(timer);
    }
  }, [fen, playerColor, game, makeAiMove]); // Rerun when FEN or player color changes

  /**
   * This handler is called by react-chessboard when the
   * *human player* makes a move by dragging a piece.
   */
  function onPieceDrop(sourceSquare: string, targetSquare: string): boolean {
    // 1. Check if it's even the player's turn.
    if (game.turn() !== playerColor) {
      return false;
    }

    // 2. Create a copy of the game to safely try the move.
    const gameCopy = new Chess(game.fen());

    // 3. Try to make the move. Default to queen promotion.
    const move = gameCopy.move({
      from: sourceSquare,
      to: targetSquare,
      promotion: 'q',
    });

    // 4. If the move is illegal, chess.js returns null.
    if (move === null) {
      return false; // Tell react-chessboard the move was invalid.
    }

    setGame(gameCopy);
    setFen(gameCopy.fen());
    setFenHistory(prev => [...prev, gameCopy.fen()]);
    setRedoStack([]);
    return true; // Tell react-chessboard the move was successful.
  }

  // ----------------------------------------------------------------
  // FEATURE HANDLERS (BUTTONS, ETC.)
  // ----------------------------------------------------------------

  /**
   * Starts a completely new game.
   */
  function handleNewGame() {
    const newGame = new Chess();
    setGame(newGame);
    setFen(newGame.fen());
    setPlayerColor('w');
    setRedoStack([]);
    setFenHistory([newGame.fen()]);
  }

  /**
   * Undoes the last two moves (player + AI).
   */
  function handleUndo() {
    // Need at least 3 positions to undo (initial + player move + AI move)
    if (fenHistory.length <= 2) return;
    
    // Go back two moves (player + AI)
    const previousFen = fenHistory[fenHistory.length - 3];
    const newGame = new Chess(previousFen);
    
    // Store the two undone positions in the redo stack
    const movedUndone = [
        fenHistory[fenHistory.length - 1], // AI move
        fenHistory[fenHistory.length - 2], // Player move
    ];
    
    setRedoStack(prev => [...movedUndone, ...prev]);
    setFenHistory(prev => prev.slice(0, -2));
    setGame(newGame);
    setFen(previousFen);
}

  /**
   * Redoes the last two moves (player + AI).
   */
  function handleRedo() {
    // Need at least 2 positions in the redo stack (player + AI moves)
    if (redoStack.length < 2) return;
    
    // Get the two moves to redo
    const [aiMove, playerMove, ...remainingStack] = redoStack;
    
    // Restore the position after both moves
    const newGame = new Chess(aiMove);
    
    setGame(newGame);
    setFen(aiMove);
    setFenHistory(prev => [...prev, playerMove, aiMove]);
    setRedoStack(remainingStack);
  }

  /**
   * Swaps sides. The player takes over the AI's pieces
   * and the AI takes over the player's.
   */
  function handleSwapSides() {
    setPlayerColor(playerColor === 'w' ? 'b' : 'w');
  }

  /**
   * Handles the selection change from the difficulty dropdown.
   */
  function handleDifficultyChange(e: React.ChangeEvent<HTMLSelectElement>) {
    setDifficulty(Number(e.target.value));
  }

  // ----------------------------------------------------------------
  // HELPER / STATUS FUNCTIONS
  // ----------------------------------------------------------------

  /**
   * Generates a status message based on the current game state.
   */
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
  return (
    <div style={styles.container}>
      

      {/* The Control Panel */}
      <div style={styles.controlsContainer}>
        <h2 style={styles.status}>{getGameStatus()}</h2>

        <div style={styles.buttonGroup}>
          <button
            style={styles.button}
            onClick={handleUndo}
            disabled={fenHistory.length <= 2} // Changed from game.history().length === 0
          >
            Undo
          </button>
          <button
            style={styles.button}
            onClick={handleRedo}
            disabled={redoStack.length === 0}
          >
            Redo
          </button>
          <button style={styles.button} onClick={handleNewGame}>
            New Game
          </button>
          <button style={styles.button} onClick={handleSwapSides}>
            Swap Sides (Play as {playerColor === 'w' ? 'Black' : 'White'})
          </button>
        </div>

        <div style={styles.difficultyControl}>
          <label htmlFor="difficulty" style={styles.label}>
            AI Difficulty:
          </label>
          <select
            id="difficulty"
            value={difficulty}
            onChange={handleDifficultyChange}
            style={styles.select}
          >
            <option value={0}>Level 0 (Beginner)</option>
            <option value={1}>Level 1 (Easy)</option>
            <option value={2}>Level 2 (Medium)</option>
            <option value={3}>Level 3 (Hard)</option>
            <option value={4}>Level 4 (Expert)</option>
          </select>
        </div>
      </div>

      {/* The Chessboard UI Component */}
      <div style={styles.boardContainer}>
        <Chessboard
        options = {{
          id: "ChessTutorBoard",
          position: fen,
          onPieceDrop: ({ sourceSquare, targetSquare }) => {
            if (!sourceSquare || !targetSquare) return false;
            return onPieceDrop(sourceSquare, targetSquare);
          },
          // Flip the board when the player swaps sides. chessboard expects
          // the strings "white" or "black"; our state uses 'w'|'b'.
          boardOrientation: playerColor === 'w' ? 'white' : 'black',
        }}
      />
      </div>
    </div>
  );
}

// ----------------------------------------------------------------
// STYLING
// (Just some basic CSS-in-JS to make it look nice)
// ----------------------------------------------------------------

const styles: { [key: string]: React.CSSProperties } = {
  container: {
    display: 'flex',
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    fontFamily: 'sans-serif',
    padding: '20px',
    gap: '30px',
  },
  boardContainer: {
    width: 'min(90vw, 500px)',
  },
  controlsContainer: {
    width: '300px',
    display: 'flex',
    flexDirection: 'column',
    gap: '20px',
  },
  status: {
    fontSize: '1.25rem',
    fontWeight: 'bold',
    textAlign: 'center',
    minHeight: '50px',
  },
  buttonGroup: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '10px',
  },
  button: {
    padding: '12px',
    fontSize: '1rem',
    border: 'none',
    borderRadius: '4px',
    backgroundColor: '#4a4a4a',
    color: 'white',
    cursor: 'pointer',
    transition: 'background-color 0.2s',
  },
  difficultyControl: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  label: {
    fontSize: '1rem',
    fontWeight: '600',
  },
  select: {
    padding: '10px',
    fontSize: '1rem',
    borderRadius: '4px',
    border: '1px solid #ccc',
  },
};

// Add this line if you're using this as a module
export default ChessTutorGame;
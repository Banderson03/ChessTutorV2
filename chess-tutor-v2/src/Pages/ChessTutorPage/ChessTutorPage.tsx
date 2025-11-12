import { useState } from 'react';
import { Chess } from 'chess.js';
import ChessTutorGame from "../../components/ChessTutorGame";
import ChessAITutor from "../../components/ChessAITutor";
import GameAnalysisPanel from "../../components/GameAnalysisPanel";

export function ChessTutorPage() {
    const [game, setGame] = useState(new Chess());
    const [fen, setFen] = useState(game.fen());
    const [actualMovesPlayed, setActualMovesPlayed] = useState<string[]>([]);
    const [completedGameMoves, setCompletedGameMoves] = useState<string[]>([]);
    const [showAnalysis, setShowAnalysis] = useState(false);

    const handleGameComplete = (moves: string[]) => {
        setCompletedGameMoves(moves);
        setShowAnalysis(true);
    };

    return (
        <div style={{ padding: '20px' }}>
            <h1>Chess Tutor Page</h1>
            
            <div style={{ display: 'flex', gap: '30px', flexWrap: 'wrap' }}>
                <ChessTutorGame 
                    game={game} 
                    setGame={setGame}
                    fen={fen}
                    setFen={setFen}
                    actualMovesPlayed={actualMovesPlayed}
                    setActualMovesPlayed={setActualMovesPlayed}
                    onGameComplete={handleGameComplete}
                />
                
                <ChessAITutor 
                    currentFen={fen} 
                    game={game}
                />
            </div>

            {showAnalysis && completedGameMoves.length > 0 && (
                <div style={{ marginTop: '30px' }}>
                    <GameAnalysisPanel 
                        moves={completedGameMoves}
                        onClose={() => setShowAnalysis(false)}
                    />
                </div>
            )}
        </div>
    )
}

export default ChessTutorPage;
import { useState } from 'react';
import { Chess } from 'chess.js';
import ChessTutorGame from "../../components/ChessTutorGame";
import ChessAiTutor from "../../components/ChessAITutor"; 
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
            <h1 style={{ textAlign: 'center', marginBottom: '30px' }}>Chess Tutor Page</h1>
            
            {/* MAIN LAYOUT CONTAINER */}
            <div style={{ 
                display: 'flex', 
                flexDirection: 'row',
                alignItems: 'flex-start', 
                justifyContent: 'center', // Centers the whole group
                gap: '20px'
            }}>
                
                {/* 1. The Game (Controls + Board) */}
                {/* We use flex-shrink-0 to prevent the board from crushing if screen is tight */}
                <div style={{ flexShrink: 0 }}>
                    <ChessTutorGame 
                        game={game} 
                        setGame={setGame}
                        fen={fen}
                        setFen={setFen}
                        actualMovesPlayed={actualMovesPlayed}
                        setActualMovesPlayed={setActualMovesPlayed}
                        onGameComplete={handleGameComplete}
                    />
                </div>
                
                {/* 2. The AI Tutor */}
                <div style={{ 
                    width: '380px', 
                    flexShrink: 0, // Keeps the tutor width fixed
                }}>
                    <ChessAiTutor 
                        currentFen={fen} 
                        game={game}
                    />
                </div>
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
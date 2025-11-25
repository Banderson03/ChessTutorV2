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
        <div style={{
            padding: '20px',
            minHeight: '100vh',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 'max(16px, 1vw)' // Responsive base font size
        }}>
            <h1 style={{ textAlign: 'center', marginBottom: '2vh' }}>The Chess Tutor</h1>

            {/* MAIN LAYOUT CONTAINER */}
            <div style={{
                display: 'flex',
                flexDirection: 'row',
                alignItems: 'flex-start', // Align top so they grow down
                justifyContent: 'center',
                gap: '2vw',
                width: '100%',
                maxWidth: '95vw',
            }}>

                {/* 1. The Game (Controls + Board) */}
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
                    flexShrink: 0,
                    // Width handled by component
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
import { useState } from 'react';
import { Chess } from 'chess.js';
import ChessTutorGame from "../../components/ChessTutorGame";
import ChessAITutor from "../../components/ChessAITutor";

export function ChessTutorPage() {
    const [game, setGame] = useState(new Chess());
    const [fen, setFen] = useState(game.fen());

    return (
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '30px', padding: '20px' }}>
            <ChessTutorGame 
                game={game} 
                setGame={setGame}
                fen={fen}
                setFen={setFen}
            />
            <ChessAITutor 
                currentFen={fen} 
                game={game}
            />
        </div>
    )
}

export default ChessTutorPage;
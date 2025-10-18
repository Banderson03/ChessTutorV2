import React from 'react';
import { Chessboard } from 'react-chessboard';
import Card from '../Components/Card';


interface ChessboardUIProps {
  fen: string;
  onDrop: (sourceSquare: string, targetSquare: string) => boolean;
  gameStatus: string;
}

const ChessboardUI: React.FC<ChessboardUIProps> = ({ fen, onDrop, gameStatus }) => (
  <Card>
    <div className="w-full max-w-[600px] mx-auto">
      <Chessboard
        options = {{
          id: "ChessTutorBoard",
          position: fen,
          onPieceDrop: ({ sourceSquare, targetSquare }) => {
            if (!sourceSquare || !targetSquare) return false;
            return onDrop(sourceSquare, targetSquare);
          },
          boardOrientation: "white",
        }}
      />
    </div>
    <div className="text-center mt-4 p-3 bg-gray-900 rounded-lg">
      <p className="font-semibold text-lg">{gameStatus}</p>
    </div>
  </Card>
);

export default ChessboardUI;
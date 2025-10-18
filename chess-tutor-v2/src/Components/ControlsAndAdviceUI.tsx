import Card from './Card';
import Spinner from './Spinner';


interface ControlsAndAdviceUIProps {
  getSuggestion: () => void;
  resetGame: () => void;
  isLoading: boolean;
  suggestion: string | null;
  explanation: string;
}

const ControlsAndAdviceUI: React.FC<ControlsAndAdviceUIProps> = ({ getSuggestion, resetGame, isLoading, suggestion, explanation }) => (
  <div className="flex flex-col gap-6">
    <Card>
      <h2 className="text-2xl font-semibold mb-4 text-sky-400">Controls</h2>
      <div className="flex flex-col sm:flex-row gap-4">
        <button
          onClick={getSuggestion}
          disabled={isLoading}
          className="w-full flex-1 bg-sky-600 hover:bg-sky-700 disabled:bg-sky-800 disabled:cursor-not-allowed disabled:text-gray-400 text-white font-bold py-3 px-4 rounded-lg transition-colors duration-200"
        >
          {isLoading ? 'Thinking...' : 'Get Suggestion'}
        </button>
        <button
          onClick={resetGame}
          className="w-full flex-1 bg-gray-600 hover:bg-gray-700 text-white font-bold py-3 px-4 rounded-lg transition-colors duration-200"
        >
          Reset Game
        </button>
      </div>
    </Card>

    <Card className="min-h-[200px]">
      <h2 className="text-2xl font-semibold mb-4 text-sky-400">Tutor's Advice</h2>
      {isLoading && <Spinner />}
      {!isLoading && !suggestion && (
        <div className="text-center text-gray-400">
          <p>Play a move, or click "Get Suggestion" to get help for the current position.</p>
        </div>
      )}
      {suggestion && (
        <div className="space-y-4">
          <div>
            <p className="font-bold text-lg">Suggested Move:
              <span className="ml-2 inline-block bg-sky-800 text-sky-200 font-mono py-1 px-3 rounded-md">{suggestion}</span>
            </p>
          </div>
          <div>
            <p className="font-bold text-lg">Why?</p>
            <p className="text-gray-300 whitespace-pre-wrap">{explanation}</p>
          </div>
        </div>
      )}
    </Card>
  </div>
);

export default ControlsAndAdviceUI;
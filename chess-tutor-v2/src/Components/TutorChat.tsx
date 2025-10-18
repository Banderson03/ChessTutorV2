import React from 'react';
import Card from './Card';


const TutorChat: React.FC = () => (
    <Card>
        <h2 className="text-2xl font-semibold mb-4 text-sky-400">Chat with Tutor</h2>
        <div className="h-full flex flex-col justify-between">
            <div className="flex-grow bg-gray-900/50 rounded-lg p-4 mb-4">
                <p className="text-gray-400">Chat UI will be here. You can ask the tutor questions directly!</p>
            </div>
            <input 
                type="text" 
                placeholder="Type your question..."
                className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-sky-500"
            />
        </div>
    </Card>
);

export default TutorChat;
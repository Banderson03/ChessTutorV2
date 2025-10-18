import React from 'react';
import ChessTutor from '../../Components/ChessTutor';
import TutorChat from '../../Components/TutorChat';



const ChessTutorPage: React.FC = () => {

  return (
    <div className="min-h-screen bg-gray-900 text-white font-sans p-4 sm:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto">
        <header className="text-center mb-8">
          <h1 className="text-4xl sm:text-5xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-sky-400 to-blue-500">
            Chess Tutor
          </h1>
          <p className="text-gray-400 mt-2">Play a game and get AI-powered advice.</p>
        </header>

        <main className="flex flex-col xl:flex-row gap-8">
            <div className="xl:w-3/4">
                <ChessTutor />
            </div>
            <aside className="xl:w-1/4">
                <TutorChat />
            </aside>
        </main>
      </div>
    </div>
  );
}

export default ChessTutorPage;
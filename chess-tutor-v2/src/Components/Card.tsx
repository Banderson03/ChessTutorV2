import React from 'react';
import type { ReactNode } from 'react';

// Props for our reusable Card component
interface CardProps {
  children: ReactNode;
  className?: string;
}

const Card: React.FC<CardProps> = ({ children, className = '' }) => (
  <div className={`bg-gray-800 bg-opacity-50 backdrop-blur-sm border border-gray-700 rounded-2xl shadow-lg p-6 h-full ${className}`}>
    {children}
  </div>
);

export default Card;

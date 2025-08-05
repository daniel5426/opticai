import React, { useState, useEffect } from 'react';
import Lottie from 'lottie-react';

interface OctahedronLoaderProps {
  size?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl' | '4xl' | '5xl';
  text?: string;
}

export function OctahedronLoader({ size = 'md', text = 'טוען נתונים...' }: OctahedronLoaderProps) {
  const [animationData, setAnimationData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/animations/Pyraminx Shape Lottie Animation.json')
      .then(response => response.json())
      .then(data => {
        setAnimationData(data);
        setLoading(false);
      })
      .catch(error => {
        console.error('Error loading animation:', error);
        setLoading(false);
      });
  }, []);

  const sizeClasses = {
    sm: 'w-8 h-8',
    md: 'w-12 h-12',
    lg: 'w-16 h-16',
    xl: 'w-24 h-24',
    '2xl': 'w-32 h-32',
    '3xl': 'w-40 h-40',
    '4xl': 'w-48 h-48',
    '5xl': 'w-56 h-56'
  };

  const textSizes = {
    sm: 'text-sm',
    md: 'text-base',
    lg: 'text-lg',
    xl: 'text-xl',
    '2xl': 'text-2xl',
    '3xl': 'text-3xl',
    '4xl': 'text-4xl',
    '5xl': 'text-5xl'
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center space-y-4">
        <div className={`relative ${sizeClasses[size]}`}>
          <div className="w-full h-full bg-blue-500 rounded-full animate-pulse" />
        </div>
        {text && (
          <div className={`text-muted-foreground ${textSizes[size]} font-medium animate-pulse`}>
            {text}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center space-y-4">
      <div className={`relative ${sizeClasses[size]}`}>
        <Lottie
          animationData={animationData}
          loop={true}
          autoplay={true}
          className="w-full h-full"
          style={{
            filter: 'drop-shadow(0 6px 12px rgba(59, 130, 246, 0.3))'
          }}
        />
      </div>
      
    </div>
  );
} 
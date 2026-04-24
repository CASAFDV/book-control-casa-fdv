'use client';

import { useEffect, useState } from 'react';
import { getScoreColor } from '@/lib/score-utils';

interface ScoreWheelProps {
  score: number;
  maxScore?: number;
  size?: number;
  label?: string;
}

export function ScoreWheel({ score, maxScore = 20, size = 150, label }: ScoreWheelProps) {
  const [animatedScore, setAnimatedScore] = useState(0);
  const color = getScoreColor(score);
  const percentage = Math.min(score / maxScore, 1);

  const strokeWidth = size * 0.08;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference * (1 - (animatedScore / maxScore));

  useEffect(() => {
    const timer = setTimeout(() => {
      setAnimatedScore(score);
    }, 100);
    return () => clearTimeout(timer);
  }, [score]);

  const center = size / 2;

  return (
    <div className="relative inline-flex flex-col items-center" style={{ width: size, height: size }}>
      <svg
        width={size}
        height={size}
        className="transform -rotate-90"
        style={{ transition: 'all 0.5s ease' }}
      >
        {/* Background circle */}
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke="rgba(255, 255, 255, 0.1)"
          strokeWidth={strokeWidth}
        />
        {/* Progress circle */}
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          style={{
            transition: 'stroke-dashoffset 1.5s ease-out, stroke 0.5s ease',
            filter: `drop-shadow(0 0 6px ${color}66)`,
          }}
        />
        {/* Metallic sheen effect */}
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke="url(#metallicGradient)"
          strokeWidth={strokeWidth * 0.3}
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          style={{
            transition: 'stroke-dashoffset 1.5s ease-out',
          }}
        />
        <defs>
          <linearGradient id="metallicGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="rgba(255,255,255,0.4)" />
            <stop offset="50%" stopColor="rgba(255,255,255,0.05)" />
            <stop offset="100%" stopColor="rgba(255,255,255,0.3)" />
          </linearGradient>
        </defs>
      </svg>
      {/* Center text */}
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span
          className="font-bold leading-none"
          style={{
            color,
            fontSize: size * 0.22,
            textShadow: `0 0 10px ${color}66`,
          }}
        >
          {score.toFixed(1)}
        </span>
        {label && (
          <span
            className="text-white/60 mt-1"
            style={{ fontSize: size * 0.08 }}
          >
            {label}
          </span>
        )}
      </div>
    </div>
  );
}

interface MiniScoreIndicatorProps {
  score: number;
  maxScore?: number;
  size?: number;
}

export function MiniScoreIndicator({ score, maxScore = 20, size = 36 }: MiniScoreIndicatorProps) {
  const color = getScoreColor(score);
  const percentage = Math.min(score / maxScore, 1);
  const strokeWidth = size * 0.1;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference * (1 - percentage);
  const center = size / 2;

  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="transform -rotate-90">
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke="rgba(255, 255, 255, 0.1)"
          strokeWidth={strokeWidth}
        />
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          style={{
            transition: 'stroke-dashoffset 1s ease-out, stroke 0.5s ease',
            filter: `drop-shadow(0 0 3px ${color}66)`,
          }}
        />
      </svg>
      <span
        className="absolute font-bold text-white"
        style={{ fontSize: size * 0.28 }}
      >
        {score.toFixed(0)}
      </span>
    </div>
  );
}

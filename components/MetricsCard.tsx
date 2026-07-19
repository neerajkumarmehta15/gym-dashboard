import React from 'react';

interface MetricsCardProps {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  isActive: boolean;
  activeRingClass: string;
  iconContainerClass: string;
  onClick: () => void;
  titleTooltip?: string;
}

export default function MetricsCard({
  title,
  value,
  icon,
  isActive,
  activeRingClass,
  iconContainerClass,
  onClick,
  titleTooltip
}: MetricsCardProps) {
  return (
    <div 
      onClick={onClick}
      className={`glass-panel glass-panel-hover p-5 rounded-2xl flex items-center gap-4 cursor-pointer transition-all duration-250 select-none ${
        isActive ? `ring-2 ${activeRingClass}` : ''
      }`}
      title={titleTooltip}
    >
      <div className={`p-3 rounded-xl ${iconContainerClass}`}>
        {icon}
      </div>
      <div>
        <p className="text-[10px] text-gray-400 uppercase tracking-widest font-mono">{title}</p>
        <h3 className="text-2xl font-black">{value}</h3>
      </div>
    </div>
  );
}

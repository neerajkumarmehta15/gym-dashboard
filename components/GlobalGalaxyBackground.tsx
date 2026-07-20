'use client';

import React from 'react';
import dynamic from 'next/dynamic';

const TechkritiGalaxyCanvas = dynamic(() => import('./TechkritiGalaxyCanvas'), { ssr: false });

export default function GlobalGalaxyBackground() {
  return <TechkritiGalaxyCanvas />;
}

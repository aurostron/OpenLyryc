'use client';

import React from 'react';
import ReactDOM from 'react-dom';

// Bridge host React instance to window for dynamic .ovis modules
if (typeof window !== 'undefined') {
  (window as any).React = (window as any).React || React;
  (window as any).ReactDOM = (window as any).ReactDOM || ReactDOM;
}

export function OvisReactBridge() {
  return null;
}

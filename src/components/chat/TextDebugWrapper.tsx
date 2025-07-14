import React from 'react';
import { Text } from 'react-native';

interface TextDebugWrapperProps {
  children: React.ReactNode;
  componentName: string;
  debug?: boolean;
}

export const TextDebugWrapper: React.FC<TextDebugWrapperProps> = ({ 
  children, 
  componentName, 
  debug = false 
}) => {
  if (!debug) {
    return <>{children}</>;
  }

  // Wrap the children and add debugging
  const wrappedChildren = React.Children.map(children, (child, index) => {
    if (typeof child === 'string') {
      console.warn(`⚠️ TEXT WARNING: String found in ${componentName} at index ${index}:`, child);
      return <Text style={{ color: 'red' }}>⚠️ {child}</Text>;
    }
    return child;
  });

  return <>{wrappedChildren}</>;
};

// Higher-order component for debugging text rendering
export const withTextDebug = <P extends object>(
  Component: React.ComponentType<P>,
  componentName: string
) => {
  return (props: P) => {
    return (
      <TextDebugWrapper componentName={componentName} debug={__DEV__}>
        <Component {...props} />
      </TextDebugWrapper>
    );
  };
}; 
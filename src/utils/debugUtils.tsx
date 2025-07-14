import React from "react";

// Debug utilities for identifying React Native text warnings

export const enableTextWarningDebug = () => {
  if (__DEV__) {
    // Override console.warn to catch React Native text warnings
    const originalWarn = console.warn;
    console.warn = (...args) => {
      const message = args[0];
      if (typeof message === 'string' && message.includes('Text strings must be rendered within a <Text> component')) {
        console.error('🚨 TEXT WARNING DETECTED!');
        console.error('Stack trace:', new Error().stack);
        console.error('Warning args:', args);
        
        // Log component tree if available
        if (global.__REACT_DEVTOOLS_GLOBAL_HOOK__) {
          console.error('React DevTools available for inspection');
        }
      }
      originalWarn.apply(console, args);
    };
  }
};

export const createTextDebugger = (componentName: string) => {
  return {
    logRender: (props: any) => {
      if (__DEV__) {
        console.log(`🔍 ${componentName} render:`, props);
      }
    },
    logTextContent: (text: any) => {
      if (__DEV__) {
        if (typeof text === 'string') {
          console.log(`📝 ${componentName} text content:`, text);
        }
      }
    },
    validateChildren: (children: any) => {
      if (__DEV__) {
        const validateChild = (child: any, path: string) => {
          if (typeof child === 'string') {
            console.error(`⚠️ TEXT WARNING: String found in ${componentName} at ${path}:`, child);
            return false;
          }
          if (Array.isArray(child)) {
            return child.every((c, i) => validateChild(c, `${path}[${i}]`));
          }
          return true;
        };
        
        if (!validateChild(children, 'root')) {
          console.error(`❌ ${componentName} has invalid children structure`);
        }
      }
    }
  };
};

export const wrapWithTextDebug = <P extends object>(
  Component: React.ComponentType<P>,
  componentName: string
) => {
  const textDebugger = createTextDebugger(componentName);
  
  return React.forwardRef<any, P>((props, ref) => {
    textDebugger.logRender(props);
    textDebugger.validateChildren(props.children);
    
    return React.createElement(Component, { ...props, ref });
  });
};

// Hook to monitor text rendering
export const useTextMonitor = (componentName: string) => {
  const textDebugger = React.useMemo(() => createTextDebugger(componentName), [componentName]);
  
  const monitorText = React.useCallback((text: any) => {
    textDebugger.logTextContent(text);
    return text;
  }, [textDebugger]);
  
  return { monitorText, textDebugger };
};

// Utility to check if a value should be wrapped in Text
export const shouldWrapInText = (value: any): boolean => {
  return typeof value === 'string' && value.trim().length > 0;
};

// Safe text renderer that always wraps strings
export const safeTextRender = (value: any, style?: any): React.ReactElement | null => {
  if (shouldWrapInText(value)) {
    return React.createElement('Text', { style }, value);
  }
  return null;
};

// Debug component that logs all renders
export const DebugWrapper: React.FC<{
  children: React.ReactNode;
  name: string;
  enabled?: boolean;
}> = ({ children, name, enabled = __DEV__ }) => {
  React.useEffect(() => {
    if (enabled) {
      console.log(`🎭 ${name} rendered`);
    }
  });

  if (!enabled) {
    return <>{children}</>;
  }

  return (
    <React.Fragment>
      {React.Children.map(children, (child, index) => {
        if (typeof child === 'string') {
          console.error(`🚨 TEXT WARNING in ${name}: String child at index ${index}:`, child);
          return React.createElement('Text', { style: { color: 'red' } }, `⚠️ ${child}`);
        }
        return child;
      })}
    </React.Fragment>
  );
}; 
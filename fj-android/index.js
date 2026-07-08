/** @format */
import React from 'react';
import { AppRegistry } from 'react-native';
import { logger, installGlobalErrorHandler } from './src/utils/Logger';
import { name as appName } from './app.json';

// Install global error handler as early as possible
installGlobalErrorHandler();
logger.info('BOOT', 'JS bundle executing, importing App module...');

let AppComponent;
let bootError = null;

try {
  const App = require('./App').default;
  logger.info('BOOT', 'App module imported successfully');
  AppComponent = App;
} catch (e) {
  bootError = e instanceof Error ? e : new Error(String(e));
  logger.error('BOOT', 'App module import FAILED', {
    message: bootError.message,
    stack: bootError.stack,
  });
}

if (bootError) {
  // Register fallback error screen
  const BootErrorScreen = require('./src/components/BootErrorScreen').default;
  const ErrorApp = () => <BootErrorScreen error={bootError} />;
  AppRegistry.registerComponent(appName, ErrorApp);
  logger.error('BOOT', 'Registered BootErrorScreen as root component');
} else {
  AppRegistry.registerComponent(appName, () => AppComponent);
  logger.info('BOOT', 'AppRegistry.registerComponent completed');
}

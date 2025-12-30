#!/usr/bin/env node
/**
 * Detects the local machine's IP address for development.
 * Used to dynamically configure the mobile app's API URL.
 */
const { networkInterfaces } = require('os');

function getLocalIP() {
  const nets = networkInterfaces();

  // Priority list of interface names (WiFi on macOS/Linux)
  const priorityInterfaces = ['en0', 'eth0', 'wlan0', 'Wi-Fi'];

  // First, try priority interfaces
  for (const name of priorityInterfaces) {
    if (nets[name]) {
      for (const net of nets[name]) {
        if (net.family === 'IPv4' && !net.internal) {
          return net.address;
        }
      }
    }
  }

  // Fallback: find any non-internal IPv4 address
  for (const name of Object.keys(nets)) {
    for (const net of nets[name]) {
      if (net.family === 'IPv4' && !net.internal) {
        return net.address;
      }
    }
  }

  return 'localhost';
}

// If run directly, print the IP
if (require.main === module) {
  console.log(getLocalIP());
}

module.exports = { getLocalIP };

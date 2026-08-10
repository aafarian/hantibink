/** Manual mock for socket.io-client used by SocketService tests. */
const mockSocket = {
  on: jest.fn(),
  off: jest.fn(),
  once: jest.fn(),
  emit: jest.fn(),
  connect: jest.fn(),
  disconnect: jest.fn(),
  close: jest.fn(),
  removeAllListeners: jest.fn(),
  connected: false,
  id: 'mock-socket-id',
};

const io = jest.fn(() => mockSocket);

module.exports = { io, mockSocket };
module.exports.default = io;

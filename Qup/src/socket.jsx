import { io } from 'socket.io-client';

export const socket = io('http://localhost:4000', {
  autoConnect: true,
});

let globalUsername = '';

export const setGlobalUsername = (username) => {
  globalUsername = username;
  socket.emit('set-username', username);
};

export const getGlobalUsername = () => globalUsername;

socket.on('connect', () => {
  if (globalUsername) {
    socket.emit('set-username', globalUsername);
  }
});
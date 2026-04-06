const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: 'http://localhost:3000' }
});

app.use(cors());
app.use(express.json());

let parties = [];
let partyIdCounter = 1;
const socketUsernames = new Map();

io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  socket.on('set-username', (username) => {
    socket.username = username;
    socketUsernames.set(socket.id, username);
  });

  socket.on('lobby:join', () => {
    socket.emit('lobby:snapshot', { parties });
  });

  socket.on('party:create', ({ name, category, maxPlayers }, callback) => {
    const party = {
      id: partyIdCounter++,
      name,
      category,
      maxPlayers,
      currentPlayers: 1,
      membersid: [socket.id],
      members: [socket.username],
      creator: socket.username,
      finalized: false
    };
    console.log(`${socket.username}(${socket.id}) created party ${name}`);
    parties.push(party);
    io.emit('lobby:newParty', party);
    socket.emit('lobby:addSelected', party);
    if (callback) callback({ ok: true, party });
  });

  
  socket.on('party:join', ({ partyId, username }, callback) => {
    const party = parties.find(p => p.id === partyId);
    if (!party) {
      return callback?.({ ok: false, message: 'Party not found' });
    }
    if (party.members.includes(username)) {
      return callback?.({ ok: false, message: 'You are already in this party' });
    }
    if (party.currentPlayers >= party.maxPlayers) {
      return callback?.({ ok: false, message: 'Party is full' });
    }
  
    party.members.push(username);
    party.currentPlayers++;
  
    io.emit('lobby:updateParty', party);

    //party full
    if (party.currentPlayers === party.maxPlayers) {
      party.finalized = true;
      io.emit('lobby:removeParty', party.id);
      for (const otherParty of parties) {
        if (otherParty.id === party.id) continue;

        if (otherParty.members.includes(username)) {
          otherParty.members = otherParty.members.filter(m => m !== username);
          otherParty.currentPlayers = otherParty.members.length;
  
          if (otherParty.currentPlayers === 0) {
            parties = parties.filter(p => p.id !== otherParty.id);
            io.emit('lobby:removeParty', otherParty.id);
          } else {
            io.emit('lobby:updateParty', otherParty);
          }
        }
      }
      const memberUsernames = party.members;
      for (const [socketId, s] of io.of('/').sockets) {
        if (memberUsernames.includes(s.username)) {
          s.emit('party:finalized', { partyId: party.id });
        }
      }
    }
    
    // if (party.currentPlayers === party.maxPlayers) {
    //   io.emit('party:finalized', { partyId });
    // }
  
    callback?.({ ok: true, party });
  });

  socket.on('party:leave', ({ partyId }, callback) => {
    const party = parties.find(p => p.id === partyId);
    if (!party) {
      return callback?.({ ok: false, message: 'Party not found' });
    }

    party.members = party.members.filter(m => m !== socket.username);
    party.currentPlayers = party.members.length;
    socket.emit('lobby:removeSelected', partyId)
    if (party.currentPlayers === 0) {
      parties = parties.filter(p => p.id !== partyId);
      io.emit('lobby:removeParty', partyId);
    } else {
      io.emit('lobby:updateParty', party);
    }

    callback?.({ ok: true, party });
  });

  socket.on('chat:join', ({ partyId }) => {
    const numericId = Number(partyId); 
    const party = parties.find(p => p.id === numericId);
    if (!party) {
      socket.emit('chat:closed');
      return;
    }

    socket.join(`party:${numericId}`);

    const history = party.history || [];
    socket.emit('chat:info', {
      party,
      history
    });
  });

  socket.on('chat:send', ({ partyId, content }) => {
    const msg = { 
      sender: socket.username || 'Anonymous', 
      content, 
      timestamp: Date.now() 
    };
    io.to(`party:${partyId}`).emit('chat:message', msg);
  });

  socket.on('chat:leave', ({ partyId, username: clientUsername }) => {
    const id = Number(partyId);
    const party = parties.find(p => p.id === id);
    if (!party) return;

    const finalUsername = clientUsername || socket.username || socketUsernames.get(socket.id) || 'Unknown';
    const room = `party:${Number(partyId)}`;
    // const username = socket.username || socketUsernames.get(socket.id) || 'Unknown';
    const systemMsg = {
      sender: 'System',
      content: `${finalUsername} has left the party.`,
      type: 'system',
      timestamp: Date.now(),
    };
    io.to(room).emit('chat:message', systemMsg);

    party.members = party.members.filter(m => m !== clientUsername);
    io.to(`party:${id}`).emit('chat:partyUpdate', party);
    if (party.members.length === 0) {
      parties = parties.filter(p => p.id !== id);
    }

    socket.leave(room);
  });

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
    socketUsernames.delete(socket.id);
  });
});

const PORT = 4000;
server.listen(PORT, () => {
  console.log(`Backend server running on http://localhost:${PORT}`);
  console.log('PostgreSQL disabled - using in-memory storage');
});
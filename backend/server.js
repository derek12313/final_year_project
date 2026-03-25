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

io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  socket.on('set-username', (username) => {
    socket.username = username;
  });

  socket.on('lobby:join', () => {
    socket.emit('lobby:snapshot', { parties });
  });

  socket.on('party:create', ({ name, category, maxPlayers, username }, callback) => {
    const party = {
      id: partyIdCounter++,
      name,
      category,
      maxPlayers,
      currentPlayers: 1,
      members: [username],
      creator: username
    };
    parties.push(party);
    io.emit('lobby:newParty', party);
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

    if (party.currentPlayers === party.maxPlayers) {
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

  socket.on('party:leave', ({ partyId, username }, callback) => {
    const party = parties.find(p => p.id === partyId);
    if (!party) {
      return callback?.({ ok: false, message: 'Party not found' });
    }

    party.members = party.members.filter(m => m !== username);
    party.currentPlayers = party.members.length;

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

  socket.on('chat:leave', ({ partyId }) => {
    const room = `party:${Number(partyId)}`;
    const username = socket.username || 'Unknown';
    const systemMsg = {
      sender: 'System',
      content: `${username} has left the party.`,
      type: 'system',
      timestamp: Date.now(),
    };
    io.to(room).emit('chat:message', systemMsg);
    socket.leave(room);
  });

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
  });
});

const PORT = 4000;
server.listen(PORT, () => {
  console.log(`Backend server running on http://localhost:${PORT}`);
  console.log('PostgreSQL disabled - using in-memory storage');
});
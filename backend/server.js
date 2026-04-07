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
      id: `${partyIdCounter++}`,
      name,
      category,
      maxPlayers,
      currentPlayers: 1,
      members: [socket.id],
      creator: socket.id,
      finalized: false
    };
    console.log(`${socket.username}(${socket.id}) created party ${name}`);
    parties.push(party);
    io.emit('lobby:newParty', party);
    socket.emit('lobby:addSelected', party);
    if (callback) callback({ ok: true, party });
  });

  
  socket.on('party:join', ({ partyId }, callback) => {
    const party = parties.find(p => p.id === partyId);
    if (!party) {
      return callback?.({ ok: false, message: 'Party not found' });
    }
    if (party.members.includes(socket.id)) {
      return callback?.({ ok: false, message: 'You are already in this party' });
    }
    if (party.currentPlayers >= party.maxPlayers) {
      return callback?.({ ok: false, message: 'Party is full' });
    }
  
    party.members.push(socket.id);
    party.currentPlayers++;
  
    io.emit('lobby:updateParty', party);
    socket.emit('lobby:addSelected', party)
    //party full
    if (party.currentPlayers === party.maxPlayers) {
      party.finalized = true;
      party.name = party.name + `(full)`;
      io.emit('lobby:updateParty', party);
      const memberUsernames = party.members;
      for (const [socketId, s] of io.of('/').sockets) {
        if (memberUsernames.includes(s.id)) {
          s.emit('party:finalized', { partyId });
        }
      }
    }
  
    callback?.({ ok: true, party });
  });

  socket.on('party:leave', ({ partyId }, callback) => {
    const party = parties.find(p => p.id === partyId);
    if (!party) {
      return callback?.({ ok: false, message: 'Party not found' });
    }

    party.members = party.members.filter(m => m !== socket.id);
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
    const party = parties.find(p => p.id === partyId);
    if (!party) {
      socket.emit('chat:closed');
      return;
    }

    socket.join(`party:${partyId}`);

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
    const party = parties.find(p => p.id === partyId);
    if (!party) return;

    const finalUsername = clientUsername || socket.username || socketUsernames.get(socket.id) || 'Unknown';
    // const username = socket.username || socketUsernames.get(socket.id) || 'Unknown';
    const systemMsg = {
      sender: 'System',
      content: `${finalUsername} has left the party.`,
      type: 'system',
      timestamp: Date.now(),
    };
    io.to(`party:${partyId}`).emit('chat:message', systemMsg);
    
    party.members = party.members.filter(m => m !== socket.id);
    party.currentPlayers = party.members.length;
    
    if (party.currentPlayers === 0) {
      parties = parties.filter(p => p.id !== partyId);
      io.emit('lobby:removeParty', partyId);
    } else {
      io.emit('lobby:updateParty', party);
    }

    socket.leave(`party:${partyId}}`);
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
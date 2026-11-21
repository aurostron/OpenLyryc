/**
 * OpenLyryc Tap Sync In-Memory Local Relay
 * Provides instant (<2ms) peer-to-peer event routing between PC and mobile on LAN.
 * Uses native Server-Sent Events (SSE) and HTTP POST.
 * Zero external internet dependency, zero STUN/ICE failures, zero mixed-content issues.
 */

class TapSyncRelay {
  constructor() {
    // Map of roomId -> { hosts: Set<res>, clients: Set<res>, lastState: any }
    this.rooms = new Map();
  }

  getRoom(roomId) {
    const cleanId = String(roomId || '').toUpperCase().trim();
    if (!this.rooms.has(cleanId)) {
      this.rooms.set(cleanId, {
        hosts: new Set(),
        clients: new Set(),
        lastState: null,
      });
    }
    return this.rooms.get(cleanId);
  }

  handleSSE(req, res, url) {
    const roomId = url.searchParams.get('room') || '';
    const role = (url.searchParams.get('role') || 'client').toLowerCase();

    if (!roomId) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Missing room parameter' }));
      return;
    }

    const room = this.getRoom(roomId);

    // Set SSE headers
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type',
    });

    res.write(`data: ${JSON.stringify({ type: 'CONNECTED', role, room: roomId })}\n\n`);

    if (role === 'host') {
      room.hosts.add(res);
      // Notify any connected clients that host is ready
      for (const clientRes of room.clients) {
        try {
          clientRes.write(`data: ${JSON.stringify({ type: 'PEER_JOIN', role: 'host' })}\n\n`);
        } catch {}
      }
      // If there are already clients, notify this host
      if (room.clients.size > 0) {
        res.write(`data: ${JSON.stringify({ type: 'PEER_JOIN', role: 'client' })}\n\n`);
      }
    } else {
      room.clients.add(res);
      // Notify hosts that client joined
      for (const hostRes of room.hosts) {
        try {
          hostRes.write(`data: ${JSON.stringify({ type: 'PEER_JOIN', role: 'client' })}\n\n`);
        } catch {}
      }
      // If host is already present, notify client
      if (room.hosts.size > 0) {
        res.write(`data: ${JSON.stringify({ type: 'PEER_JOIN', role: 'host' })}\n\n`);
      }
    }

    // Keepalive ping every 15s to keep mobile connection alive
    const pingInterval = setInterval(() => {
      try {
        res.write(': keepalive\n\n');
      } catch {
        clearInterval(pingInterval);
      }
    }, 15000);

    req.on('close', () => {
      clearInterval(pingInterval);
      if (role === 'host') {
        room.hosts.delete(res);
        for (const clientRes of room.clients) {
          try {
            clientRes.write(`data: ${JSON.stringify({ type: 'PEER_LEAVE', role: 'host' })}\n\n`);
          } catch {}
        }
      } else {
        room.clients.delete(res);
        for (const hostRes of room.hosts) {
          try {
            hostRes.write(`data: ${JSON.stringify({ type: 'PEER_LEAVE', role: 'client' })}\n\n`);
          } catch {}
        }
      }

      if (room.hosts.size === 0 && room.clients.size === 0) {
        this.rooms.delete(roomId);
      }
    });
  }

  async handleSend(req, res) {
    let body = '';
    req.on('data', (chunk) => (body += chunk));
    req.on('end', () => {
      try {
        const parsed = JSON.parse(body || '{}');
        const { room: roomId, action, payload, sender } = parsed;

        if (!roomId || !action) {
          res.writeHead(400, {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          });
          res.end(JSON.stringify({ error: 'Missing room or action' }));
          return;
        }

        const room = this.getRoom(roomId);
        const sseMessage = `data: ${JSON.stringify({ action, payload, sender })}\n\n`;

        if (sender === 'host') {
          // Broadcast to all clients
          for (const clientRes of room.clients) {
            try {
              clientRes.write(sseMessage);
            } catch {}
          }
        } else {
          // Broadcast to all hosts
          for (const hostRes of room.hosts) {
            try {
              hostRes.write(sseMessage);
            } catch {}
          }
        }

        res.writeHead(200, {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        });
        res.end(JSON.stringify({ ok: true }));
      } catch (err) {
        res.writeHead(500, {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        });
        res.end(JSON.stringify({ error: err?.message || 'Invalid JSON' }));
      }
    });
  }
}

export const tapSyncRelay = new TapSyncRelay();

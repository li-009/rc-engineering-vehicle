import WebSocket, { WebSocketServer } from 'ws';
import express from 'express';
import http from 'http';
import path from 'path';

// --- CONFIG ---
const PORT = 3000;

// --- STATE ---
// Store active vehicles: { "car-001": WebSocket }
const vehicles = new Map<string, WebSocket>();
// Store active users (controllers): { "user-session-id": WebSocket }
const users = new Map<string, WebSocket>();

// --- SERVER SETUP ---
const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: '/ws' });

// Serve Dashboard (Frontend Agent's Work)
app.use(express.static(path.join(__dirname, '../public')));

console.log(`[Master] Server starting on port ${PORT}...`);

// --- WEBSOCKET LOGIC (Backend Agent) ---
wss.on('connection', (ws: WebSocket, req) => {
    let role: 'vehicle' | 'user' | 'unknown' = 'unknown';
    let id: string = '';

    console.log('[Net] New connection established.');

    ws.on('message', (message: Buffer | string) => {
        // 1. Binary Data -> Likely Video Stream from Vehicle
        if (Buffer.isBuffer(message) || message instanceof ArrayBuffer) {
            if (role === 'vehicle' && id) {
                // Determine who is watching this car?
                // For MVP: Broadcast to ALL connected 'users' (Simple Logic)
                // In production: Look up subscribers for this specific Car ID
                broadcastToUsers(id, message);
            }
            return;
        }

        // 2. Text Data -> JSON Protocol
        try {
            const str = message.toString();
            const json = JSON.parse(str);

            switch (json.type) {
                case 'auth':
                    handleAuth(ws, json);
                    break;
                case 'control':
                    handleControl(json);
                    break;
                default:
                    console.warn(`[Proto] Unknown message type: ${json.type}`);
            }
        } catch (e) {
            console.error('[Proto] JSON Parse Error:', e);
        }
    });

    ws.on('close', () => {
        if (role === 'vehicle' && id) {
            console.log(`[Fleet] Vehicle ${id} disconnected.`);
            vehicles.delete(id);
            broadcastCarList(); // Update Dashboard
        } else if (role === 'user') {
            console.log(`[User] User disconnected.`);
        }
    });

    // --- HANDLERS ---
    
    function handleAuth(socket: WebSocket, data: any) {
        if (data.role === 'vehicle') {
            role = 'vehicle';
            id = data.id || 'unknown-car';
            vehicles.set(id, socket);
            console.log(`[Fleet] Vehicle Registered: ${id}`);
            broadcastCarList();
        } else if (data.role === 'user') {
            role = 'user';
            id = `user-${Date.now()}`;
            users.set(id, socket);
            console.log(`[User] Admin/Controller Connected: ${id}`);
            // Send current list immediately
            sendCarList(socket);
        }
    }

    function handleControl(data: any) {
        const targetId = data.target_id;
        const targetCar = vehicles.get(targetId);
        
        if (targetCar && targetCar.readyState === WebSocket.OPEN) {
            // Forward control command to specific car
            targetCar.send(JSON.stringify(data)); 
            // console.log(`[Ctrl] Sent command to ${targetId}`);
        } else {
            // console.warn(`[Ctrl] Target ${targetId} not found/offline.`);
        }
    }
});

// --- HELPERS ---

function broadcastToUsers(sourceCarId: string, videoData: any) {
    // In real fleet, only users watching 'sourceCarId' should get this
    // For MVP/Debugging: Send to all users
    users.forEach((u) => {
        if (u.readyState === WebSocket.OPEN) {
            // Optional: Wrap binary? Or just send raw?
            // Raw is easiest for jsmpeg
            u.send(videoData);
        }
    });
}

function getCarList() {
    // Generate list of active cars
    return Array.from(vehicles.keys()).map(carId => ({
        id: carId,
        status: 'online',
        ping: 0 // Placeholder
    }));
}

function broadcastCarList() {
    const list = getCarList();
    const msg = JSON.stringify({ type: 'car_list', data: list });
    users.forEach(u => u.send(msg));
}

function sendCarList(socket: WebSocket) {
    const list = getCarList();
    socket.send(JSON.stringify({ type: 'car_list', data: list }));
}

server.listen(PORT, () => {
    console.log(`[Master] Server running at http://localhost:${PORT}`);
});

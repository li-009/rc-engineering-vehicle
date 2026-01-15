const WebSocket = require('ws');
const { WebSocketServer } = require('ws');
const express = require('express');
const http = require('http');
const path = require('path');

const PORT = 3000;
const vehicles = new Map();
const users = new Map();

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: '/ws' });

app.use(express.static(path.join(__dirname, '../public')));

console.log(`[Master] Server starting on port ${PORT}...`);

wss.on('connection', (ws) => {
    let role = 'unknown';
    let id = '';

    console.log('[Net] New connection established.');

    ws.on('message', (message) => {
        // Binary Data -> Video Stream
        if (Buffer.isBuffer(message) || message instanceof ArrayBuffer) {
            if (role === 'vehicle' && id) {
                broadcastToUsers(id, message);
            }
            return;
        }

        // JSON Data -> Protocol
        try {
            const str = message.toString();
            const json = JSON.parse(str);
            if (json.type === 'auth') handleAuth(ws, json);
            else if (json.type === 'control') handleControl(json);
        } catch (e) { console.error(e); }
    });

    ws.on('close', () => {
        if (role === 'vehicle' && id) {
            console.log(`[Fleet] Vehicle ${id} disconnected.`);
            vehicles.delete(id);
            broadcastCarList();
        }
    });

    function handleAuth(socket, data) {
        if (data.role === 'vehicle') {
            role = 'vehicle';
            id = data.id || 'unknown';
            vehicles.set(id, socket);
            console.log(`[Fleet] Vehicle Registered: ${id}`);
            broadcastCarList();
        } else if (data.role === 'user') {
            role = 'user';
            id = `user-${Date.now()}`;
            users.set(id, socket);
            sendCarList(socket);
        }
    }

    function handleControl(data) {
        const targetId = data.target_id;
        const targetCar = vehicles.get(targetId);
        if (targetCar && targetCar.readyState === WebSocket.OPEN) {
            targetCar.send(JSON.stringify(data));
        }
    }

    function broadcastToUsers(sourceId, data) {
        users.forEach(u => { if (u.readyState === WebSocket.OPEN) u.send(data); });
    }
    function getCarList() {
        return Array.from(vehicles.keys()).map(id => ({ id, status: 'online' }));
    }
    function broadcastCarList() {
        const msg = JSON.stringify({ type: 'car_list', data: getCarList() });
        users.forEach(u => u.send(msg));
    }
    function sendCarList(socket) {
        socket.send(JSON.stringify({ type: 'car_list', data: getCarList() }));
    }
});

server.listen(PORT, () => console.log(`[Master] Server running at http://localhost:${PORT}`));

const WebSocket = require('ws');

// Connect as a Vehicle
const ws = new WebSocket('ws://localhost:3000/ws');

ws.on('open', function open() {
    console.log('[MockCar] Connected to Server');

    // Auth
    ws.send(JSON.stringify({
        type: 'auth',
        role: 'vehicle',
        id: 'mock-car-999'
    }));

    // Simulate sending a "Video Frame" (binary) every 1s
    setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
            // Send dummy binary buffer
            const buffer = Buffer.alloc(10);
            ws.send(buffer);
            // console.log('[MockCar] Sent video frame');
        }
    }, 1000);
});

ws.on('message', function message(data) {
    console.log('[MockCar] Rx: %s', data);
});

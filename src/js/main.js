import _ from './assets'

import Socket from './Socket';
import globals from './globals';
import ChunkManager from './ChunkManager';
import Renderer from './Renderer';
import camera from './camera';
import player from './player';
import EventManager from './EventManager'
import {
    screenToBoardSpace,
    halfMap
} from './utils'
import {
    palette,
    maxZoom
} from './config'

let elements = {
    mainCanvas: document.getElementById('board'),
    palette: document.getElementById('palette'),
    online: document.getElementById('onlineCounter'),
    coords: document.getElementById('coords')
}

const evMng = new EventManager(elements.mainCanvas);

function updatePlayerCoords(clientX, clientY) {
    let [newX, newY] = screenToBoardSpace(clientX, clientY);

    if (newX === player.x && newY === player.y) {
        return
    }

    player.x = newX;
    player.y = newY;

    coords.innerText = `(${player.x}, ${player.y})`

    if (player.color != -1)
        renderer.needRender = true;
}

window.onresize = () => {
    elements.mainCanvas.width = window.innerWidth;
    elements.mainCanvas.height = window.innerHeight;

    ctx.imageSmoothingEnabled = false;
    ctx.webkitImageSmoothingEnabled = false;
    ctx.mozImageSmoothingEnabled = false;
    ctx.msImageSmoothingEnabled = false;
    ctx.oImageSmoothingEnabled = false;

    renderer.needRender = true;
}


evMng.on('mousemove', (e) => {
    if (e.buttons === 1) {
        camera.x -= e.movementX / window.devicePixelRatio / camera.zoom;
        camera.y -= e.movementY / window.devicePixelRatio / camera.zoom;

        camera.x = Math.max(Math.min(camera.x, halfMap[0]), -halfMap[0]);
        camera.y = Math.max(Math.min(camera.y, halfMap[1]), -halfMap[1]);

        renderer.needRender = true;
    } else {
        updatePlayerCoords(e.clientX, e.clientY);
    }
});

evMng.on('zoom', (dist) => {
    camera.zoom += dist/(maxZoom/camera.zoom);
    camera.checkZoom();
    renderer.needRender = true;
})

elements.mainCanvas.onclick = (e) => {
    let [x, y] = screenToBoardSpace(e.clientX, e.clientY);

    socket.sendPixel(x, y, player.color);
}

elements.mainCanvas.onwheel = (e) => {
    camera.zoomTo(e.deltaY);
    updatePlayerCoords(e.clientX, e.clientY);

    renderer.needRender = true;
}

palette.forEach((color, id) => {
    const el = document.createElement('div');
    el.style.backgroundColor = `rgb(${color.join(',')})`;
    el.className = 'paletteColor';

    el.onclick = () => {
        player.color = id;
    }

    elements.palette.appendChild(el);
})

const ctx = elements.mainCanvas.getContext('2d');
ctx.imageSmoothingEnabled = false;

const socket = new Socket(1488);
globals.socket = socket;

const chunkManager = new ChunkManager();
globals.chunkManager = chunkManager;

const renderer = window.renderer = new Renderer(ctx);
globals.renderer = renderer;

const renderLoop = () => {
    requestAnimationFrame(() => {
        renderer.requestRender();
        renderLoop();
    })
}
renderLoop();

const tickLoop = setInterval(() => {
    
}, 1000 / 60);

window.onresize();

socket.once('opened', () => {
    renderer.needRender = true;
});

socket.on('online', count => {
    elements.online.innerText = count;
});
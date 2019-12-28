import _ from './assets'

import Socket from './Socket';
import globals from './globals';
import ChunkManager from './ChunkManager';
import Renderer from './Renderer';
import camera from './camera';
import player from './player';
import ToolManager from './ToolManager'
import {
    screenToBoardSpace,
    halfMap,
    isDarkColor
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

const evMng = globals.eventManager;

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
    updatePlayerCoords(e.clientX, e.clientY);
}).on('mousedown', (e) => {
    updatePlayerCoords(e.clientX, e.clientY); // yes
});

evMng.on('zoom', (dist) => {
    camera.zoom += dist/(maxZoom/camera.zoom);
    camera.checkZoom();
    renderer.needRender = true;
})

elements.mainCanvas.onwheel = (e) => {
    camera.zoomTo(e.deltaY);
    updatePlayerCoords(e.clientX, e.clientY);

    renderer.needRender = true;
}

palette.forEach((color, id) => {
    const el = document.createElement('div');
    el.style.backgroundColor = `rgb(${color.join(',')})`;
    el.classList = ['paletteColor ' + (isDarkColor(...color) ? 'dark' : 'light')];

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

const eventManager = new ToolManager(document.getElementById('board'));

const renderLoop = () => {
    requestAnimationFrame(() => {
        renderer.requestRender();
        renderLoop();
    })
}
renderLoop();

window.onresize();

socket.once('opened', () => {
    renderer.needRender = true;
});

socket.on('online', count => {
    elements.online.innerText = count;
});
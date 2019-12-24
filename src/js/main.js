import '../css/style.css'

import Socket from './Socket';
import globals from './globals';
import ChunkManager from './ChunkManager';
import Renderer from './Renderer';
import camera from './camera';
import player from './player';
import {
    screenToBoardSpace
} from './utils'
import {
    palette
} from './config'

let elements = {
    mainCanvas: document.getElementById('board'),
    palette: document.getElementById('palette')
}

window.onresize = () => {
    elements.mainCanvas.width = window.innerWidth;
    elements.mainCanvas.height = window.innerHeight;

    ctx.imageSmoothingEnabled = false;

    renderer.render();
}


elements.mainCanvas.onmousemove = (e) => {
    if(e.buttons === 1){
        camera.x -= e.movementX/camera.zoom;
        camera.y -= e.movementY/camera.zoom;

        renderer.render();
    }
}

elements.mainCanvas.onclick = (e) => {
    let [x, y] = screenToBoardSpace(e.clientX, e.clientY);

    socket.sendPixel(x, y, player.color);
}

elements.mainCanvas.onwheel = (e) => {
    camera.zoomTo(e.deltaY);
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

socket.once('opened', () => {
    renderer.render();
})

const chunkManager = new ChunkManager();
globals.chunkManager = chunkManager;

const renderer = new Renderer(ctx);
globals.renderer = renderer;

window.onresize();
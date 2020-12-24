import _ from './assets';

import Socket from './Socket';
import globals from './globals';
import ChunkManager from './ChunkManager';
import Renderer from './Renderer';
import { FXRenderer } from './fxcanvas';
import player from './player';
import ToolManager from './ToolManager';
import { isDarkColor } from './utils/color';
import { calculateColumnSize } from './utils/misc';

import { palette } from './config';
import {
    updateMe,
    initInputs,
    initOtherCoolFeatures
} from './actions';
import { init as initTranslate } from './translate';

const {
    elements,
} = globals;

window.onresize = () => {
    elements.mainCanvas.width = window.innerWidth;
    elements.mainCanvas.height = window.innerHeight;

    elements.fxCanvas.width = window.innerWidth;
    elements.fxCanvas.height = window.innerHeight;

    ctx.imageSmoothingEnabled = false;
    ctx.webkitImageSmoothingEnabled = false;
    ctx.mozImageSmoothingEnabled = false;
    ctx.msImageSmoothingEnabled = false;
    ctx.oImageSmoothingEnabled = false;

    renderer.needRender = true;

    if (!globals.mobile) {
        calculateColumnSize();
    }
}

window.oncontextmenu = function (e) {
    e.preventDefault();
}

palette.forEach((color, id) => {
    const el = document.createElement('div');
    el.style.backgroundColor = `rgb(${color.join(',')})`;
    el.classList = ['paletteColor ' + (isDarkColor(...color) ? 'dark' : 'light')];
    el.id = 'col' + id;

    el.onclick = () => {
        player.switchColor(id);
    }
    el.oncontextmenu = () => {
        player.switchSecondColor(id);
    }

    elements.palette.appendChild(el);
})

const ctx = elements.mainCanvas.getContext('2d');
ctx.imageSmoothingEnabled = false;

const socket = new Socket(location.port || 80);
globals.socket = socket;

const chunkManager = new ChunkManager();
globals.chunkManager = chunkManager;

const renderer = window.renderer = new Renderer(ctx);
globals.renderer = renderer;

const fxRenderer = new FXRenderer();
globals.fxRenderer = fxRenderer;

globals.toolManager = new ToolManager(document.getElementById('board'));

const renderLoop = () => {
    requestAnimationFrame(() => {
        renderer.requestRender();
        renderLoop();
    })
}
renderLoop();

window.onresize();

socket.on('opened', () => { });

socket.on('online', count => {
    $('.online').text(count);
});

window.globals = globals;

updateMe();
initTranslate();
initInputs();
initOtherCoolFeatures();

window.player = player;
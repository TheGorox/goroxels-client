import sharedConf from '../../shared/config.json'
import {
    rgb2abgr,
    rgb2hex
} from './utils/color'

const path = document.location.pathname.replace(/[^\d^\w]/g, '');
let index = sharedConf.canvases.findIndex(canvas => canvas.name === path);
export const canvasId = index === -1 ? 0 : index;

let canvasConf = sharedConf.canvases[canvasId];

export const
    chunkSize = canvasConf.chunkSize,
    boardWidth = canvasConf.boardWidth * chunkSize,
    boardHeight = canvasConf.boardHeight * chunkSize,
    palette = canvasConf.palette,
    minZoom = 0.25,
    maxZoom = 64;

export const
    argbPalette = new Uint32Array(palette.map((rgb) => rgb2abgr(...rgb))),
    hexPalette = palette.map(rgb2hex),
    boardChunkWid = canvasConf.boardWidth,
    boardChunkHei = canvasConf.boardHeight,
    cooldown = canvasConf.cooldown;

export const argbToId = {};
Array.from(argbPalette.values()).forEach((argb, i) => argbToId[argb] = i)
import sharedConf from '../../shared/config.json'
import {
    rgb2abgr,
    rgb2hex,
    applyColor
} from './utils/color'
import { getOrDefault } from './utils/localStorage'

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
    // palette for fast rendering
    bgrPalette = new Uint32Array(palette.map((rgb) => rgb2abgr(...rgb))),
    hexPalette = palette.map(rgb2hex),
    boardChunkWid = canvasConf.boardWidth,
    boardChunkHei = canvasConf.boardHeight,
    cooldown = canvasConf.cooldown;

export const game = {
    disableColors: JSON.parse(getOrDefault('disableColors', false)),
    chatLimit: parseInt(getOrDefault('chatLimit', 100), 10)
}

export const argbToId = {};
Array.from(bgrPalette.values()).forEach((argb, i) => argbToId[argb] = i)
import {
    rgb2abgr,
    rgb2hex
} from './utils/color'
import { getOrDefault } from './utils/localStorage'

export let canvasId;

export let
    canvasName,
    chunkSize,
    boardWidth, boardHeight,
    palette

export let downloaded = false;

export let
    // a palette for fast rendering
    bgrPalette, hexPalette,
    boardChunkWid, boardChunkHei,
    cooldown;

export const game = {
    chatLimit: parseInt(getOrDefault('chatLimit', 100), 10),
    showProtected: false
}

export let argbToId = {};

async function loadConfig(){
    const response = await fetch('/config.json');
    return await response.json();
}

export async function download() {
    let config
    try{
        config = await loadConfig();
    }catch(e){
        toastr.error('Failed to load config from server. Try to reload the page');
    }

    const path = document.location.pathname.replace(/[^\d^\w]/g, '');
    let index = config.canvases.findIndex(canvas => canvas.name === path);
    canvasId = index === -1 ? 0 : index;

    let canvasCfg = config.canvases[canvasId];

    canvasName = canvasCfg.name,
        chunkSize = canvasCfg.chunkSize,
        boardWidth = canvasCfg.boardWidth * chunkSize,
        boardHeight = canvasCfg.boardHeight * chunkSize,
        palette = canvasCfg.palette;

    // palette for fast rendering
    bgrPalette = new Uint32Array(palette.map((rgb) => rgb2abgr(...rgb))),
        hexPalette = palette.map(rgb2hex),
        boardChunkWid = canvasCfg.boardWidth,
        boardChunkHei = canvasCfg.boardHeight,
        cooldown = canvasCfg.cooldown;

    Array.from(bgrPalette.values()).forEach((argb, i) => argbToId[argb] = i);

    downloaded = true;
    toCall.forEach(f => f());
    toCall = [];
}

let toCall = [];
export function callOnLoad(cb){
    if(downloaded) return cb();
    toCall.push(cb);
}
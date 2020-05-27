import globals from './globals'


import {
    rgb2abgr,
    rgb2hex
} from './utils'

import sharedConf from '../../shared/config.json'
let canvasConf = sharedConf.canvases[globals.canvasId];

export const
    chunkSize = canvasConf.chunkSize,
    boardWidth = canvasConf.boardWidth * chunkSize,
    boardHeight = canvasConf.boardHeight * chunkSize,
    palette = canvasConf.palette,
    minZoom = 0.25,
    maxZoom = 64,
    argbPalette = new Uint32Array(palette.map((rgb) => rgb2abgr(...rgb))),
    hexPalette = palette.map(rgb2hex),
    boardChunkWid = canvasConf.boardWidth,
    boardChunkHei = canvasConf.boardHeight

export const argbToId = {};
Array.from(argbPalette.values()).forEach((argb, i) => argbToId[argb] = i)
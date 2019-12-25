import {
    rgb2abgr
} from './utils'

export const
    chunkSize = 512,
    boardWidth = 8 * 512,
    boardHeight = 8 * 512,
    palette = [
        [240, 240, 220],
        [250, 200, 0],
        [16, 200, 64],
        [0, 160, 200],
        [210, 64, 64],
        [160, 105, 75],
        [115, 100, 100],
        [16, 24, 32]
    ],
    minZoom = 0.25,
    maxZoom = 64,
    argbPalette = palette.map((rgb) => rgb2abgr(...rgb)),
    boardChunkWid = boardWidth / chunkSize,
    boardChunkHei = boardHeight / chunkSize
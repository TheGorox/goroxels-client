import {
    rgb2abgr,
    rgb2hex
} from './utils'

export const
    chunkSize = 512,
    boardWidth = 1 * 512,
    boardHeight = 1 * 512,
    palette = [[40,19,18],[135,23,14],[120,33,26],[56,30,28],[97,15,3],[85,22,13],[201,43,0],[192,45,5],[145,40,12],[159,60,23],[239,80,0],[209,87,25],[40,37,35],[242,214,190],[255,232,194],[216,210,197],[253,245,212],[162,196,146],[60,87,59],[36,58,49],[92,132,123],[174,194,190],[70,86,85],[196,220,230],[84,112,128],[182,203,219],[173,186,205],[146,162,186],[152,157,168],[26,29,36],[93,5,20],[77,6,18]],
    minZoom = 0.25,
    maxZoom = 64,
    argbPalette = new Uint32Array(palette.map((rgb) => rgb2abgr(...rgb))),
    hexPalette = palette.map(rgb2hex),
    boardChunkWid = boardWidth / chunkSize,
    boardChunkHei = boardHeight / chunkSize
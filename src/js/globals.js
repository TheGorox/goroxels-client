import EventEmitter from 'events'
import EventManager from './EventManager'

import {
    insanelyLongMobileBrowserCheck
} from './utils/misc'

import {
    get as getls
} from './utils/localStorage'

export default {
    socket: null,
    chunkManager: null,
    renderer: null,
    fxRenderer: null,
    player: null,
    toolManager: null,
    events: new EventEmitter,
    eventManager: new EventManager(document.getElementById('board')),
    mainCtx: document.getElementById('board').getContext('2d'),
    fxCtx: document.getElementById('fx').getContext('2d'),
    lang: (getls('preferredLang') || navigator.language || navigator.userLanguage || 'en').substr(0, 2),
    mobile: insanelyLongMobileBrowserCheck(),
    users: {},
    elements: { // TODO move it to elements.js
        mainCanvas: $('#board')[0],
        fxCanvas: $('#fx')[0],
        palette: $('#palette')[0],
        online: $('#onlineCounter')[0],
        coords: $('#coords')[0],
        topMenu: $('#topMenu')[0],
        topMenuContent: $('#topMenu>.content')[0]
    }
}
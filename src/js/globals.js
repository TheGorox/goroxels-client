import EventEmitter from 'events'
import EventManager from './EventManager'

import config from '../../shared/config.json'
import {
    insanelyLongMobileBrowserCheck
} from './utils'

import ls from './ls'

import $ from 'jquery';
window.$ = $; // todo  ???

const path = document.location.pathname.replace(/[^\d^\w]/g, '');
let id = config.canvases.findIndex(canvas => canvas.name === path);

export default {
    canvasId: id === -1 ? 0 : id,
    socket: null,
    chunkManager: null,
    renderer: null,
    fxRenderer: null,
    player: null,
    events: new EventEmitter,
    eventManager: new EventManager(document.getElementById('board')),
    mainCtx: document.getElementById('board').getContext('2d'),
    fxCtx: document.getElementById('fx').getContext('2d'),
    lang: (ls.get('preferredLang') || navigator.language || navigator.userLanguage || 'en').substr(0, 2),
    mobile: insanelyLongMobileBrowserCheck(),
    elements: {
        mainCanvas: $('#board')[0],
        fxCanvas: $('#fx')[0],
        palette: $('#palette')[0],
        online: $('#onlineCounter')[0],
        coords: $('#coords')[0],
        topMenu: $('#topMenu')[0],
        topMenuContent: $('#topMenu').children()[0]
    }
}
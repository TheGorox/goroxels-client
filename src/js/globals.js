import EventEmitter from 'events'
import EventManager from './EventManager'

import ls from './ls'

export default {
    socket: null,
    chunkManager: null,
    renderer: null,
    player: null,
    events: new EventEmitter,
    eventManager: new EventManager(document.getElementById('board')),
    mainCtx: document.getElementById('board').getContext('2d'),
    lang: (ls.get('preferredLang') || navigator.language || navigator.userLanguage || 'en').substr(0, 2)
}
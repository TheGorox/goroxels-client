import EventEmitter from 'events'
import EventManager from './EventManager'

export default {
    socket: null,
    chunkManager: null,
    renderer: null,
    player: null,
    events: new EventEmitter,
    eventManager: new EventManager(document.getElementById('board')),
    mainCtx: document.getElementById('board').getContext('2d')
}
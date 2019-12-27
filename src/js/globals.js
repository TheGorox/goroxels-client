import EventEmitter from 'events'

export default {
    socket: null,
    chunkManager: null,
    renderer: null,
    player: null,
    events: new EventEmitter
}
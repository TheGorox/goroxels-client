import EventEmitter from 'events'
import interact from 'interactjs'

function anyInputFocused() {
    return document.activeElement.tagName === 'INPUT'
}

export default class EventManager extends EventEmitter {
    /**
     * 
     * @param {Element} element 
     */
    constructor(element) {
        super();

        this.el = element

        this.pointers = new Map();
        this._lastDist = null;
        this._zoomed = false;

        element.addEventListener('pointerdown', e => {
            this._lastDist = null;
            if (this.pointers.size === 0) {
                this.emit('mousedown', e)
            }

            this.pointers.set(e.pointerId, e);
        });
        document.addEventListener('pointermove', e => {
            if (this.pointers.size <= 1) {
                this.emit('mousemove', e);
            }
        });
        interact(element).gesturable({
            onmove: e => {
                // console.log(e);
                this.emit('zoom', e.ds);

                this.emit('mousemove', {
                    buttons: e.buttons,

                    clientX: e.clientX,
                    clientY: e.clientY,

                    movementX: e.dx * devicePixelRatio,
                    movementY: e.dy * devicePixelRatio,

                    gesture: true
                })
            }
        })
        document.addEventListener('pointerup', e => {
            this._lastDist = null;
            if (!this.pointers.has(e.pointerId)) return;

            if (this.pointers.size === 1)
                this.emit('mouseup', e);

            this.pointers.delete(e.pointerId);
        });

        this.tickLoop = setInterval(() => {
            this.emit('tick')
        }, 1000 / 60);

        document.addEventListener('keydown', e => {
            if (!anyInputFocused()) {
                this.emit('keydown', e)
            }
        });

        document.addEventListener('keyup', e => {
            if (!anyInputFocused()) { // means that this class is shit
                this.emit('keyup', e)
            }
        });

        element.addEventListener('wheel', e => this.emit('wheel', e))
        element.addEventListener('mouseleave', e => this.emit('mouseleave', e))
    }
}
import EventEmitter from 'events'
import interact from 'interactjs'

function anyInputFocused() {
    return document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA'
}

export default class EventManager extends EventEmitter {
    /**
     * 
     * @param {Element} element 
     */
    constructor(element) {
        super();

        this.el = element

        this._zoomed = false;

        // true from when two pointers started touch
        // until both of them off
        this.startedGesture = false,
            this.pointers = 0;
        function checkGesture(evName) {
            let wasGesture = this.startedGesture;
            if (evName === 'up') {
                this.pointers = Math.max(this.pointers - 1, 0);
                if (this.pointers == 0) this.startedGesture = false;
            } else if (evName === 'down') {
                if (++this.pointers >= 2)
                    wasGesture = this.startedGesture = true;
            }
            return wasGesture
        }
        checkGesture = checkGesture.bind(this)

        // some of my friends has an issue where 
        // event.movementX/Y sometimes was not present
        let pointerMovementWorkaround = {};

        const FFA_REPLACE_MOVEMENT = true;

        element.addEventListener('pointerdown', e => {
            e.gesture = checkGesture('down');
            this.emit('mousedown', e);
        });
        document.addEventListener('pointermove', e => {
            if (FFA_REPLACE_MOVEMENT || !e.movementX || !e.movementY) {
                // by default, movementX and movementY are read only
                Object.defineProperty(e, 'movementX', {
                    writable: true
                });
                Object.defineProperty(e, 'movementY', {
                    writable: true
                });

                let lastPos = pointerMovementWorkaround[e.pointerId];
                if (!lastPos) {
                    e.movementX = 0;
                    e.movementY = 0;
                } else {
                    e.movementX = e.clientX - lastPos[0];
                    e.movementY = e.clientY - lastPos[1];
                }

                pointerMovementWorkaround[e.pointerId] = [e.clientX, e.clientY];
            }
            // not emitted because Interactjs below will emit this correctly
            if (!checkGesture('move')) {
                this.emit('mousemove', e);
            }
        });
        document.addEventListener('pointerup', e => {
            let pointersCnt = this.pointers;
            e.gesture = checkGesture('up');

            // emit event only if 'pointerdown' event was on canvas
            if (pointersCnt)
                this.emit('mouseup', e);

            delete pointerMovementWorkaround[e.pointerId];
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

        this.tickLoop = setInterval(() => {
            this.emit('tick')
        }, 1000 / 60);

        document.addEventListener('keydown', e => {
            if (!anyInputFocused()) {
                this.emit('keydown', e)
            }
        });

        document.addEventListener('keyup', e => {
            if (!anyInputFocused()) {
                this.emit('keyup', e)
            }
        });

        element.addEventListener('wheel', e => this.emit('wheel', e))
        element.addEventListener('mouseleave', e => this.emit('mouseleave', e))
    }
}
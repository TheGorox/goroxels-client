import EventEmitter from 'events';
import globals from './globals';
import tools from './tools';
import camera from './camera';
import player from './player';
import {
    screenToBoardSpace
} from './utils/conversions';
import {
    insanelyLongMobileBrowserCheck,
    stringifyKeyEvent,
    decodeKey
} from './utils/misc';
import { getLS, setLS } from './utils/localStorage';
import me from './me';

const coords = globals.elements.coords;

function updatePlayerCoords(clientX, clientY) {
    let [newX, newY] = screenToBoardSpace(clientX, clientY);

    if (newX === player.x && newY === player.y) {
        return
    }

    player.x = newX;
    player.y = newY;

    coords.innerText = `(${player.x}, ${player.y})`

    if (player.color != -1 && camera.zoom > 1)
        globals.renderer.needRender = true;
}

const isMobile = insanelyLongMobileBrowserCheck();

export default class ToolManager extends EventEmitter {
    constructor() {
        super();

        this.tools = tools;
        this.tool = tools.mover;

        this._keyBinds = {};
        this._colorBinds = {};
        this.activeTools = {};

        this.addTools();
        this.loadBinds();
        this.initEvents();

        me.callOnLoaded(this.filterTools.bind(this));
    }

    filterTools() {
        Object.keys(this.tools).forEach(name => {
            if (this.tools[name].requiredRole > me.role) {
                if (isMobile) {
                    $(`#tool_${name}`).remove();
                }
            }
        })
    }

    addTools() {
        const toolsEl = document.getElementById('tools');

        Object.keys(this.tools).forEach(name => {
            const tool = this.tools[name];

            if (isMobile) {
                if (!tool.icon) return;

                let el = document.createElement('div');
                el.classList = 'toolContainer';
                el.id = `tool_${name}`;
                let img = document.createElement('img');
                img.className = 'toolIcon';
                img.src = tool.icon;

                el.appendChild(img);
                toolsEl.appendChild(el); // todo add click choosing etc

                el.addEventListener('pointerdown', choose.bind(this));

                function choose() {
                    let oldTool = document.getElementsByClassName('toolContainer selected')[0]
                    if (oldTool)
                        oldTool.className = 'toolContainer';

                    el.classList = ['toolContainer selected'];
                    this.tool = tool;
                }
                if (tool.name === 'mover')
                    choose.apply(this);
            } else {
                if (player)
                    this._keyBinds[tool.key] = tool;
            }
        })

        // TODO make another css class/id for that
        if (!isMobile)
            document.getElementById('tools').style.cssText = 'display:none !important';
    }

    initEvents() {
        let em = globals.eventManager;

        if (isMobile) {
            em.on('zoom', zoom => {
                camera.zoom *= zoom + 1;
                camera.checkZoom();
                globals.renderer.needRender = true;
                globals.fxRenderer.needRender = true;
            });

            em.on('mousedown', e => {
                updatePlayerCoords(e.clientX, e.clientY);
            });

            em.on('mousemove', e => {
                updatePlayerCoords(e.clientX, e.clientY);
            });

            let events = [
                ['mousedown', 'down'],
                ['mousemove', 'move'],
                ['mouseup', 'up']
            ];

            events.forEach(event => {
                const [realEvent, myEvent] = event;
                em.on(realEvent, e => {
                    let tool = this.tool;
                    if (e && e.gesture) {
                        this.tool.emit('_gesture');
                        tool = this.tools.mover;
                    }
                    if (!tool) return

                    // emit to selected tool
                    tool.emit(myEvent, e);
                    // emit to other subscribers
                    this.emit(myEvent, e);
                });
            });
        } else {
            // TODO все слушатели напрямую к eventManager
            em.on('mousedown', e => {
                this.tools.mover.emit('down', e)
            });
            em.on('mouseup', e => {
                if (e.button === 2) {
                    player.switchColor(-1);
                    player.switchSecondColor(-1);
                }
                this.tools.mover.emit('up', e);
            });
            em.on('mousemove', e => {
                if (e.buttons === 0 || camera.noMoving) {
                    updatePlayerCoords(e.clientX, e.clientY);
                }

                this.tool.emit('move', e)
                this.emit('move', e);
            });

            em.on('keydown', e => {
                let str = stringifyKeyEvent(e);
                if (!str) return;

                const tool = this._keyBinds[str];

                if (tool) {
                    e.preventDefault();
                    e.stopPropagation();

                    // TODO
                    this.tool = tool; // костыль, переделать
                    // Как? подписываться на mousemove при down
                    // и отписываться при up
                    tool.emit('down', e);
                }
            });

            em.on('keyup', e => {
                let str = stringifyKeyEvent(e);
                if (!str) return;

                const tool = this._keyBinds[str];

                for (let name of Object.keys(this.tools)) {
                    const tool2 = this.tools[name];

                    if (!tool2.key || tool2 === tool)
                        continue;

                    const key = decodeKey(tool2.key);
                    if (key.code === e.code) {
                        tool2.emit('up', e)
                    }
                }

                if (tool) {
                    e.preventDefault();
                    e.stopPropagation();

                    tool.emit('up', e);
                }
            });

            em.on('wheel', e => {
                const oldZoom = camera.zoom;
                camera.zoomTo(e.deltaY);

                const dx = e.clientX - window.innerWidth / 2;
                const dy = e.clientY - window.innerHeight / 2;

                camera.moveTo((dx / oldZoom), (dy / oldZoom));
                camera.moveTo(-(dx / camera.zoom), -(dy / camera.zoom));
            });
        }

        // TODO: add listener directly to ToolManager, istead of tool itself, avoiding cyclic check
        em.on('tick', e => {
            Object.keys(this.tools).forEach(name => {
                const tool = this.tools[name];
                if (tool.listenerCount('tick') > 0) {
                    tool.emit('tick', e);
                }
            });
        });
    }

    changeKey(tool, key) {
        const oldKey = tool.key;
        delete this._keyBinds[oldKey];

        tool.key = key;
        this._keyBinds[key] = tool
    }

    loadBinds() {
        const str = getLS('keyBinds');
        let newBinds;
        try {
            newBinds = JSON.parse(str);
            if (!newBinds)
                return;
        } catch {
            toastr.error('Error on parsing key binds from local storage');
            localStorage.removeItem('keyBinds');
            return
        }

        let toolname;
        for (let key of Object.keys(newBinds)) {
            if (toolname = this.findByName(key))
                this.changeKey(this.tools[toolname], newBinds[key]);
        }
    }

    findByName(name) {
        const keys = Object.keys(this.tools);
        return keys.find(key => this.tools[key].name === name)
    }

    initColorBinds(){

    }

    loadColorBinds(){

    }
}
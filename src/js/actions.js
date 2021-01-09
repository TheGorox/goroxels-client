import me from './me';
import {
    cooldown,
    canvasId,
    argbToId,
    chunkSize
} from './config';
import player from './player';
import {
    getOrDefault,
    set as setLs
} from './utils/localStorage'
import {
    screenToBoardSpace
} from './utils/conversions'
import template from './template'
import globals from './globals';
import {
    chatInput,
    chat as chatEl,
    ui,
    topMenu,
    urlInput,
    xInput,
    yInput,
    opacInput
} from './elements'
import {
    accountSettings,
    keyBinds,
    uiSettings,
    gameSettings
} from './windows'
import { ROLE, ROLE_I } from './constants'
import chat from './chat';

async function fetchMe() {
    const response = await fetch('/api/me', {
        credentials: "include"
    });
    return await response.json();
}

export async function updateMe() {
    const user = await fetchMe();

    me.update(user);
    player.updateBucket(getMyCooldown());
    if (user.registered) {
        chatInput.removeAttr('disabled');
        chatInput.val('');

        $('#chatNick').text(user.name);
    }else{
        chatInput.attr('disabled');
        chatInput.val('login to chat');

        $('#chatNick').text('CHAT');
    }
}

export function getMyCooldown() {
    const cooldowns = cooldown;
    return cooldowns[ROLE_I[me.role]] || [0, 32];
}

export function initInputs() {
    loadValues();
    initHandlers();
    initButtons();
    initChat();
}

function loadValues() {
    const urlVal = getOrDefault('template.url', 'https://i.imgur.com/46fwf6C.png');
    urlInput.val(urlVal);

    const xVal = getOrDefault('template.x', 0);
    xInput.val(parseInt(xVal, 10));

    const yVal = getOrDefault('template.y', 0);
    yInput.val(parseInt(yVal, 10));

    const opacVal = getOrDefault('template.opac', 0.5);
    opacInput.val(parseFloat(opacVal));
}

function initHandlers() {
    function forceTemplateUpdate() {
        template.update();

        // TODO optimize it maybe
        saveTemplate();
    }

    function forceTemplateRender() {
        forceTemplateUpdate();
        template.render();
    }

    urlInput.on('input', forceTemplateUpdate);
    xInput.on('input', forceTemplateRender);
    yInput.on('input', forceTemplateRender);
    opacInput.on('input', forceTemplateUpdate);

    // initial force
    forceTemplateRender();
}

export function initOtherCoolFeatures() {
    initTemplateMoveByMouse();
    initModMenu();
}

function initTemplateMoveByMouse() {
    $(document).on('mousedown', e => {
        if (!e.ctrlKey) return;

        e.stopPropagation();
        e.preventDefault();

        let lastCord = screenToBoardSpace(e.clientX, e.clientY).map(x => x |= 0);

        function mousemove(e) {
            e.stopPropagation();
            e.preventDefault();

            const boardPos = screenToBoardSpace(e.clientX, e.clientY);
            boardPos[0] |= 0;
            boardPos[1] |= 0;

            let [lastX, lastY] = boardPos;

            if (lastX === lastCord[0] && lastY === lastCord[1])
                return;

            // console.log(lastX, lastY, boardPos, lastCord)

            xInput.val(template.x -= lastCord[0] - lastX);
            yInput.val(template.y -= lastCord[1] - lastY);

            template.render();

            lastCord = boardPos;

            saveTemplate();
        }
        $(document).on('mousemove', mousemove);
        $(document).one('mouseup mouseleave', () => {
            $(document).off('mousemove', mousemove);
        })
    })
}

function saveTemplate(){
    setLs('template.x', template.x);
    setLs('template.y', template.y);
    setLs('template.url', template.url);
    setLs('template.opac', template.opacity);
}

function initButtons() {
    $('#accountSettings').on('click', accountSettings);
    $('#toolBinds').on('click', keyBinds);
    $('#uiSettings').on('click', uiSettings);
    $('#canvasSettings').on('click', gameSettings);
}

function initChat(){
    chatInput.on('keydown', e => {
        if(e.code !== 'Enter') return;

        const message = chatInput.val();
        if(!message.length) return;

        chatInput.val('');

        chat.handleMessage(message);
    })
}


export function placePixel(x, y, col, store=true) {
    const oldCol = globals.chunkManager.getChunkPixel(x, y),
        isProtected = globals.chunkManager.getProtect(x, y);

    if (oldCol !== col && (!isProtected || me.role === ROLE.ADMIN) && globals.socket.connected) {
            if(store){
                player.placed.push([x, y, globals.chunkManager.getChunkPixel(x, y)]);

                if(player.placed.length > player.maxPlaced*2){
                    player.placed = player.placed.slice(-player.maxPlaced);
                }
            }

            globals.chunkManager.setChunkPixel(x, y, col);
            globals.socket.sendPixel(x, y, col);
            globals.renderer.needRender = true;
            globals.fxRenderer.needRender = true;

            globals.socket.pendingPixels[x + ',' + y] = setTimeout(() => {
                globals.chunkManager.setChunkPixel(x, y, oldCol);
                globals.renderer.needRender = true;
            }, 3000)
    }else{
        if(isProtected){
            toastr.error('This pixel is protected.', 'Ouch!', {
                preventDuplicates: true,
                timeOut: 5000
            })
        }
    }
}

export function toggleChat(){
    if (chatEl.css('display') === 'none') {
        chatEl.show();
        chatEl.css('left', '');
    } else {
        chatEl.css('left', -chatEl.width() - 30);
        setTimeout(() => chatEl.hide(), 500);
    }
}

export function toggleTopMenu(){
    if (topMenu.css('display') === 'none') {
        topMenu.show();
        topMenu.css('margin-top', '');
    } else {
        topMenu.css('margin-top', -topMenu.height() - 30);
        setTimeout(() => topMenu.hide(), 500);
    }
}

export function toggleEverything(){
    ui.toggle();
}

export function showProtected(show=true){
    globals.chunkManager.chunks.forEach(chunk => {
        chunk.showProtected = show;
        chunk.needRender = true;
    });
    globals.renderer.needRender = true;
}

function initModMenu(){
    initSliding();
    initSendAlerts();

    function initSliding(){
        $('#modMenu .title').on('click', e => {
            const m = $('#modMenu');
            if(m.data('state') === 'open'){
                m.data('state', 'close');
                m.css('right', 0);
            }else{
                m.data('state', 'open');
                m.css('right', $('#modMenu .body').css('width'));
            }
        })
    }

    function initSendAlerts(){
        $('#sendAlerts').on('click', () => {
            const val = $('#sendAlertsText').val();
            if(val.length == 0 || val.length > 2000) return;

            $('#sendAlertsText').val('');
            globals.socket.sendAlert('all', val);
        })
    }
}
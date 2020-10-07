import me from './me';
import {
    cooldown,
    canvasId
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
    visible as checkCoords
} from './utils/camera';
import {
    chatInput,
    chat,
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
    uiSettings
} from './windows'

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
    return cooldowns[me.role] || [0, 32];
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
}

function initChat(){
    chatInput.on('keydown', e => {
        if(e.keyCode !== 13) return;

        const message = chatInput.val();
        if(!message.length) return;

        chatInput.val('');

        globals.socket.sendChatMessage(message, canvasId);
    })
}


export function placePixel(x, y, col, store=true) {
    if (checkCoords(x, y) &&
        globals.chunkManager.getChunkPixel(x, y) !== col &&
        globals.socket.connected) {
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
    }
}

export function toggleChat(){
    if (chat.css('display') === 'none') {
        chat.show();
        chat.css('left', '');
    } else {
        chat.css('left', -chat.width() - 30);
        setTimeout(() => chat.hide(), 500);
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
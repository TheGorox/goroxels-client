import me from './me';
import {
    cooldown, palette
} from './config';
import player from './player';
import {
    getLS,
    getOrDefault,
    setLS
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
    gameSettings,
    toolsWindow,
    help
} from './windows'
import { ROLE, ROLE_I } from './constants'
import chat from './chat';
import Window from './Window';
import { translate as t_ } from './translate';
import { getRecommendedColorSize } from './utils/misc';

export async function apiRequest(path, config = {}) {
    // handle json body of request
    if (config.body && typeof config.body === 'object') {
        if (!config.headers) config.headers = {};

        config.headers['Content-Type'] = 'application/json';
        config.body = JSON.stringify(config.body);
    }
    const response = await fetch('/api' + path, config);

    if (response.headers.get('Content-Type') && response.headers.get('Content-Type').includes('application/json')) {
        try {
            const json = await response.json()

            if (json.errors) {
                json.errors.forEach(error => {
                    toastr.error(error);
                })
            }

            response.json = () => json;
        } catch (e) { }
    }

    return response
}

async function fetchMe() {
    const response = await apiRequest('/me');
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
    } else {
        chatInput.attr('disabled');
        chatInput.val(t_('login to chat'));

        $('#chatNick').text('CHAT');
    }
}

export function getMyCooldown() {
    const cooldowns = cooldown;

    if (ROLE_I[me.role] == 'ADMIN') return [0, 32]
    return cooldowns[ROLE_I[me.role]] || cooldown.GUEST;
}

export function initInputs() {
    loadValues();
    initHandlers();
    initButtons();
    initChat();
}

function loadValues() {
    const urlVal = getOrDefault('template.url', 'https://i.imgur.com/46fwf6C.png?width=80', true);
    urlInput.val(urlVal);

    const xVal = getOrDefault('template.x', 0, true);
    xInput.val(parseInt(xVal, 10));

    const yVal = getOrDefault('template.y', 0, true);
    yInput.val(parseInt(yVal, 10));

    const opacVal = getOrDefault('template.opac', 0.5, true);
    opacInput.val(parseFloat(opacVal));
}

function saveTemplate() {
    setLS('template.x', template.x, true);
    setLS('template.y', template.y, true);
    setLS('template.url', template.url, true);
    setLS('template.opac', template.opacity, true);
}

export function updateTemplate() {
    template.update();
    template.render();
    saveTemplate();
}

function initHandlers() {
    urlInput.on('input', updateTemplate);
    xInput.on('input', updateTemplate);
    yInput.on('input', updateTemplate);
    opacInput.on('input', updateTemplate);

    updateTemplate();
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

function initButtons() {
    $('#accountSettings').on('click', accountSettings);
    $('#toolBinds').on('click', keyBinds);
    $('#uiSettings').on('click', uiSettings);
    $('#canvasSettings').on('click', gameSettings);
    $('#toolsB').on('click', toolsWindow);
}

function initChat() {
    $(document).on('keydown', e => {
        if (e.key !== 'Enter') return;

        if ($('#chatInput').is(':focus')) {
            // send if focused
            const message = chatInput.val();
            if (!message.length)
                return chatInput.trigger('blur');

            chatInput.val('');

            chat.handleMessage(message);
        } else {
            // or focus if not
            $('#chatInput').trigger('focus');
        }
    });

}

export function placePixels(pixels, store = true) {
    // does not check pixels

    if (store) {
        pixels.forEach(([x, y]) => {
            player.placed.push([x, y, globals.chunkManager.getChunkPixel(x, y)]);
        })
    }
    globals.socket.sendPixels(pixels, false);
}

export function placePixel(x, y, col, store = true) {
    const oldCol = globals.chunkManager.getChunkPixel(x, y),
        isProtected = globals.chunkManager.getProtect(x, y);

    if (oldCol !== col && (!isProtected || me.role === ROLE.ADMIN) && globals.socket.connected) {
        if (store) {
            player.placed.push([x, y, globals.chunkManager.getChunkPixel(x, y)]);

            if (player.placed.length > player.maxPlaced * 2) {
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
    } else {
        if (isProtected) {
            toastr.error(t_('This pixel is protected.'), t_('Error!'), {
                preventDuplicates: true,
                timeOut: 5000
            })
        }
    }
}

export function toggleChat() {
    if (chatEl.css('display') === 'none') {
        chatEl.show();
        chatEl.css('left', '');
    } else {
        chatEl.css('left', -chatEl.width() - 30);
        setTimeout(() => chatEl.hide(), 500);
    }
}

export function toggleTopMenu() {
    if (topMenu.css('display') === 'none') {
        topMenu.show();
        topMenu.css('margin-top', '');
    } else {
        topMenu.css('margin-top', -topMenu.height() - 30);
        setTimeout(() => topMenu.hide(), 500);
    }
}

export function toggleEverything() {
    // $('#ui>div>div').each((_, el) => {
    //     if(el.style.getPropertyPriority('display') == 'important')
    //         return;

    //     if (el.style.display === 'none') {
    //         $(el).css('display', '')
    //     } else {
    //         $(el).css('display', 'none')
    //     }
    // })
    $('#ui').fadeToggle(100);
}

export function showProtected(show = true) {
    globals.chunkManager.chunks.forEach(chunk => {
        chunk.showProtected = show;
        chunk.needRender = true;
    });
    globals.renderer.needRender = true;
}

function initModMenu() {
    initSliding();
    initSendAlerts();

    function initSliding() {
        $('#modMenu .title').on('click', e => {
            const m = $('#modMenu');
            if (m.data('state') === 'open') {
                m.data('state', 'close');
                m.css('right', 0);
            } else {
                m.data('state', 'open');
                m.css('right', $('#modMenu .body').css('width'));
            }
        })
    }

    function initSendAlerts() {
        $('#sendAlerts').on('click', () => {
            const val = $('#sendAlertsText').val();
            if (val.length == 0 || val.length > 2000) return;

            $('#sendAlertsText').val('');
            globals.socket.sendAlert('all', val);
        })
    }
}

export async function fetchCaptcha() {
    const resp = await apiRequest('/captcha/get');
    return await resp.text()
}

export async function solveCaptcha(answer) {
    const resp = await apiRequest('/captcha/solve', {
        method: 'POST',
        body: { answer }
    });

    const json = await resp.json();

    if (json.success !== undefined)
        return json.success;

    return false
}

export function setPaletteRows(rows) {
    let width = (window.innerWidth / 100) * rows;

    $('#palette').css('max-width', width);
}
export function setPaletteColorsSize(size) {
    if(!size) return;
    $('.paletteColor').css('width', size).css('height', size);
}

// you can't just change css se..
function changeSelector(selector, obj) {
    let el;
    if (!(el = document.getElementById('REPLACE-' + selector))) {
        el = document.createElement('style');
        el.id = 'REPLACE-' + selector;
    }

    let styleArr = Object.keys(obj).map(prop => prop + ':' + obj[prop]);
    el.innerText = `${selector}{${styleArr.join(';')}}`;

    document.head.appendChild(el);
}

export function initMobileMenuToggler() {
    $('.showMenu,.hideMenu').on('click', toggleTopMenu)
}

export function toggleEmojis(state) {
    state ? $('#emotions').show() : $('#emotions').hide();
}

export function updateEmojis(list) {
    const container = $('#emotions');
    let html = '';

    for (let el of list) {
        html += `<div class="emotion">${el}</div>`;
    }

    container.html(html);

    $('div', container).on('click', e => {
        $('#chatInput')[0].value += e.target.innerText;
        $('#chatInput').trigger('focus');
    })
}

export function updateBrush(size) {
    player.brushSize = +size;
    globals.fxRenderer.needRender = true;

    globals.renderer.preRenderBrush();

    $('#brushSizeCounter').text(size - 1);
}

export function togglePlaced(state){
    state ? $('#placedPixels').show() : $('#placedPixels').hide();
}

export function updatePlaced(count, handCount){
    // FIXME: move it to interval?
    $('#placedPixels').text(count);
    if(handCount)
        $('#placedPixels').attr('title', handCount);
}

let lastPlaced = player.placedCount;
setInterval(() => {
    if(lastPlaced !== player.placedCount){
        setLS('placedCount', player.placedCount, true);
        lastPlaced = player.placedCount;
    }
}, 3000)

function initUISettings() {
    setPaletteColorsSize(getLS('colorSize', true))
    toggleEmojis(getLS('hideEmojis') != 1);
    updateEmojis(getOrDefault('emojis', '🙁 🤔 😀 💚').split(' '));
    togglePlaced(!+getOrDefault('hidePlaced', 1))
    updatePlaced(getLS('placedCount', true));
}

function initMobileChatToggle(){
    $('.showChat').on('click', () => chat.mobileShow());
    $('#hideChat').on('click', () => chat.mobileHide());
}

function initHelpButton(){
    $('.helpBtn').on('click', () => {
        help()
    })
}

export function initOtherCoolFeatures() {
    initTemplateMoveByMouse();
    initModMenu();
    initMobileMenuToggler();
    initUISettings();
    initMobileChatToggle();
    initHelpButton();
    player.init();
}

export function fixColorsWidth(){
    const savedWidth = getLS('colorSize', true);
    const calculated = getRecommendedColorSize();

    const colSize = +savedWidth || calculated
    $('.paletteColor').css('width', colSize).css('height', colSize);
}

export function fixChatPosition(){
    const paletteHeight = $('#palette').innerHeight();
    $('#chat').css('bottom', paletteHeight+4);
}
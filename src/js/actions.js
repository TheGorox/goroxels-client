import me from './me';
import {
    canvasName,
    cooldown, game, hexPalette, palette
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
    help,
    authWindow,
    onlineViewWindow
} from './windows'
import { ROLE, ROLE_I } from './constants'
import chat from './chat';
import Window from './Window';
import { translate as t_ } from './translate';
import { getPathsafeDate, getRecommendedColorSize } from './utils/misc';
import { patterns } from './convert/patterns';
import { isDarkColor } from './utils/color';
import Chunk from './Chunk';

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

export async function updateMe() {
    await me.load();

    player.updateBucket(getMyCooldown());
    if (me.registered) {
        chatInput.removeAttr('disabled');
        chatInput.val('');

        $('#loginButtons').hide();
        $('#chatNick').text(me.name);
        $('.authBtn').hide();
    } else {
        chatInput.attr('disabled');
        chatInput.val(t_('login to chat'));

        // $('#chatNick').text('CHAT');
        $('#chatNick').hide();
        $('.authBtn').show();
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
    const urlVal = getOrDefault('template.url', 'https://i.imgur.com/4GQIMQ7.png', true);
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
    $('.authBtn').on('click', authWindow);
}

function initChat() {
    $(document).on('keydown', e => {
        if (e.key !== 'Enter') return;

        if ($('#chatInput').is(':focus') || globals.mobile) {
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

    initChatHeightWorkaround();
}

export function placePixels(pixels, store = true) {
    // does not checks pixels

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

    if (oldCol !== col && (!isProtected || me.role >= ROLE.MOD) && globals.socket.connected) {
        if (store) {
            player.placed.push([x, y, globals.chunkManager.getChunkPixel(x, y)]);

            if (player.placed.length > player.maxPlaced * 2) {
                player.placed = player.placed.slice(-player.maxPlaced);
            }
        }

        globals.chunkManager.setChunkPixel(x, y, col);
        globals.socket.sendPixel(x, y, col);

        globals.socket.pendingPixels[x + ',' + y] = setTimeout(() => {
            globals.chunkManager.setChunkPixel(x, y, oldCol);
            globals.renderer.needRender = true;
        }, 3000)
    } else {
        if (isProtected && me.role < ROLE.MOD) {
            toastr.error(t_('This pixel is protected.'), t_('Error!'), {
                preventDuplicates: true,
                timeOut: 750
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
    fixChatPosition();
}

export function showProtected(show = true) {
    game.showProtected = show;
    globals.chunkManager.chunks.forEach(chunk => {
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
                m.css('right', '');
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

// an old analog for setPaletteColorsSize
export function setPaletteRows(rows) {
    let width = (window.innerWidth / 100) * rows;

    $('#palette').css('max-width', width);
}


export function setPaletteColorsSize(size) {
    if (size === undefined) {
        size = getRecommendedColorSize();
    }
    $('.paletteColor').css('width', size).css('height', size);
}

// you can't just change css se..
export function changeSelector(selector, obj) {
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

export function togglePlaced(state) {
    state ? $('#placedPixels').show() : $('#placedPixels').hide();
}

export function updatePlaced(count, handCount) {
    // FIXME: move it to interval?
    $('#placedPixels').text(count);
    if (handCount)
        $('#placedPixels').attr('title', handCount);
}

let lastPlaced = player.placedCount;
setInterval(() => {
    if (lastPlaced !== player.placedCount) {
        setLS('placedCount', player.placedCount, true);
        lastPlaced = player.placedCount;
    }
}, 3000)

export function fixColorsWidth() {
    const savedWidth = getLS('colorSize', true);
    const calculated = getRecommendedColorSize();

    const colSize = +savedWidth || calculated
    setPaletteColorsSize(colSize);
    fixChatPosition();
}

function initUISettings() {
    fixColorsWidth();
    toggleEmojis(getLS('hideEmojis') != 1);
    updateEmojis(getOrDefault('emojis', '🙁 🤔 😀 😄 💚 😡 👋 👍 😐').split(' '));
    togglePlaced(!+getOrDefault('hidePlaced', 1))
    updatePlaced(getLS('placedCount', true));
}

function initMobileChatToggle() {
    $('.showChat').on('click', () => {
        $('.showChat').removeClass('showChat-notify');
        chat.mobileShow()
    });
    $('#hideChat').on('click', () => {
        $('.showChat').removeClass('showChat-notify');
        chat.mobileHide()
    });
}

function initHelpButton() {
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
    initCoordsClick();
    initOnlineViewer();
    initMenuResizer();
    showHelpIfFirstTime();
}

function initCoordsClick() {
    globals.elements.coords.addEventListener('click', function () {
        globals.elements.chatInput.value += this.innerText;
        globals.elements.chatInput.focus();
    })
}

export function makeScreenshot() {
    const canvas = globals.chunkManager.dumpAll();

    const link = document.createElement('a');
    link.download = `GX ${canvasName} ${getPathsafeDate()}.png`;
    link.href = canvas.toDataURL()
    link.click();
}

// beta and probably temprorary
// purposely not optimised
export function showPatternsOnPalette() {
    unloadPalettePatterns();

    palette.forEach(([r, g, b], i) => {
        const pat = patterns[i % patterns.length];

        const canvas = document.createElement('canvas');
        canvas.width = canvas.height = 14;
        const ctx = canvas.getContext('2d');

        ctx.fillStyle = hexPalette[i];

        for (let i = 0; i < 7 * 7; i++) {
            if (!pat[i]) continue;
            const x = i % 7;
            const y = i / 7 | 0;

            ctx.fillRect(x * 2, y * 2, 2, 2);
        }

        function toI(x, y) {
            return (x + y * 14) * 4;
        }

        // draw contour
        let imd = ctx.getImageData(0, 0, 14, 14).data;
        if (isDarkColor(r, g, b)) {
            ctx.fillStyle = 'white';
            let coords = [];
            for (let x = 0; x < 14; x++) {
                for (let y = 0; y < 14; y++) {
                    if (imd[toI(x, y) + 3]) continue

                    const top = imd[toI(x, y - 1) + 3];
                    const bottom = imd[toI(x, y + 1) + 3];
                    const left = imd[toI(x - 1, y) + 3];
                    const right = imd[toI(x + 1, y) + 3];

                    const leftTop = imd[toI(x - 1, y - 1) + 3];
                    const rightTop = imd[toI(x + 1, y - 1) + 3];
                    const leftBottom = imd[toI(x - 1, y + 1) + 3];
                    const rightBottom = imd[toI(x + 1, y + 1) + 3];

                    if (top || bottom || left || right ||
                        leftTop || rightTop || leftBottom || rightBottom) {
                        ctx.fillRect(x, y, 1, 1);
                    }
                }
            }
        }


        imd = ctx.getImageData(0, 0, 14, 14).data;
        ctx.fillStyle = 'black';
        for (let i = 0; i < 14 * 14; i++) {
            if (!imd[i * 4 + 3])
                ctx.fillRect(i % 14, i / 14 | 0, 1, 1)
        }


        const dataurl = canvas.toDataURL();
        const img = document.createElement('img');
        img.src = dataurl;
        img.style.cssText =
            `position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        image-rendering: pixelated;
        width: inherit`;
        $(`#col${i}`).append(img);
    })
}

export function unloadPalettePatterns() {
    $('.paletteColor>img').remove();
}

export function removeOldKeybinds() {
    try {
        const str = getLS('keyBinds');
        const json = JSON.parse(str);
        for (let bind of Object.values(json)) {
            let key = bind.split('+').slice(-1);
            key = +key;
            if (!isNaN(key)) {
                localStorage.removeItem('keyBinds');
                return
            }
        }
    } catch { }
}

function initOnlineViewer() {
    $('#onlineColumn .columnHeader').on('click', async () => {
        let json;
        try {
            const resp = await fetch('/api/online');
            json = await resp.json();
        } catch (e) {
            toastr.error(e);
            return
        }

        onlineViewWindow(json);
    });
}

function initChatHeightWorkaround() {
    // -webkit-fill-available does not work since
    // the best way to define height that i know 
    // for the moment is through the script

    function fixChatHeight() {
        document.documentElement.style.setProperty('--gorox-chat-height', $(window).height() + 'px');
    }

    $(window).on('resize', fixChatHeight);
    fixChatHeight();
}

export function fixChatPosition() {
    const paletteHeight = $('#palette').innerHeight();
    $('#chat').css('bottom', paletteHeight + 4);
}

function initMenuResizer() {
    const resizer = $('#menuResizer');
    const resizerStripes = $('#resizingStripes');

    let curHeight = +getLS('columnHeight');
    if (isNaN(curHeight) || curHeight == 0) {
        curHeight = 123;
    } else if (curHeight < 0) {
        curHeight = 0;
    } else if (curHeight >= (window.screen.height - 250)) {
        curHeight = window.screen.height - 250;
    }
    $('.columnContent').css('height', curHeight);

    let resizeTimeout;
    let resizeLock = false;

    function unfade() {
        resizer.css('height', '7px');
        resizer.css('background-color', '#4c4c4c');
        resizerStripes.css('opacity', '1');
    }

    function fade() {
        clearTimeout(resizeTimeout);
        resizer.css('height', '');
        resizer.css('background-color', '');
        resizerStripes.css('opacity', '');
    }

    resizer.on('mouseover', () => {
        clearTimeout(resizeTimeout);
        resizeTimeout = setTimeout(() => {
            unfade();
        }, 500)
    })

    resizer.on('mouseout', () => {
        if (resizeLock) return;

        fade();
    })

    function onmousedown() {
        resizeLock = true;
        unfade();

        function onmousemove(e) {
            curHeight += e.originalEvent.movementY;
            $('.columnContent').css('height', curHeight);
            setLS('columnHeight', curHeight);
        }
        function oncemouseup() {
            $(document).off('mousemove', onmousemove);
            resizeLock = false;
            fade();
        }

        $(document).on('mousemove', onmousemove)
        $(document).one('mouseup', oncemouseup)
    }
    resizer.on('mousedown', onmousedown);
}

function showHelpIfFirstTime() {
    const shownAlready = getLS('helpShown');
    if (!shownAlready) {
        setLS('helpShown', '1');
        help();
    }
}
import translates from './translates';

export function translate(val){
    return translates._(val);
}

export function init(){
    const els = [...document.getElementsByClassName('translate')];
    for(let el of els){
        const text = el.innerText.toLowerCase();
        const tr = translate(text);
        el.innerText = tr;
    }
}
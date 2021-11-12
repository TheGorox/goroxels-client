import translates from './translates';

export function translate(val){
    return translates._(val);
}

export function init(){
    // translate inner text
    const els = [...document.getElementsByClassName('translate')];
    for(let el of els){
        let text = el.innerText;
        // remove html padding
        text = text.replace(/^[\n\s]+/, '').replace(/[\n\s]+$/,'')
        const tr = translate(text);
        el.innerText = tr;
        console.log(el, tr)
    }
    // translate attributes
    const allEls = $('*');
    const transEls = allEls.filter((_, el) => el.dataset.translate);
    for(let el of transEls){
        try{
            const text = el[el.dataset.translate];
            const tr = translate(text);
            el[el.dataset.translate] = tr;
        }catch(e){}
    }
}
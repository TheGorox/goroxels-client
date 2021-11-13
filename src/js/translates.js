import {
    getLS as getls
} from './utils/localStorage'

function getLang(){
    return (getls('preferredLang') || navigator.language || navigator.userLanguage || 'en').substr(0, 2)
}
const lang = getLang();

import en from './translates/en';
import ru from './translates/ru';

const languages = {
    en,
    ru
}

const userLanguage = languages[lang] || languages['en'];

export default {
    _(value){
        return userLanguage[value] || languages['en'][value] || value
    }
}
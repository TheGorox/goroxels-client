import { canvasName } from "../config";

export function getOrDefault(key, defaultVal, isLocal=false){
    if(isLocal){
        key = canvasName + '.' + key
    }
    // NOTE: empty strings are falsy too
    return localStorage.getItem(key) || defaultVal
}

export function getLS(key, isLocal=false){
    if(isLocal){
        key = canvasName + '.' + key
    }
    return localStorage.getItem(key);
}

export function setLS(key, value, isLocal=false){
    if(isLocal){
        key = canvasName + '.' + key
    }
    return localStorage.setItem(key, value)
}
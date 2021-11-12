function isLocal(ip){
    return ip.startsWith('127.0') || ip.startsWith('192.168') || ip.startsWith('::')
}

export default {
    isLocal
}
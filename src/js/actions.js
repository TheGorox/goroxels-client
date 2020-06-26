import globals from './globals';
import me from './me';
import {
    cooldown
} from './config';
import player from './player';

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
}

export function getMyCooldown() {
    const cooldowns = cooldown;
    return cooldowns[me.role] || [0, 32];
}
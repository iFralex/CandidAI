"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.randomBetween = randomBetween;
exports.delay = delay;
exports.humanType = humanType;
function randomBetween(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}
function delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}
async function humanType(page, selector, text) {
    await page.type(selector, text, { delay: 30 });
}

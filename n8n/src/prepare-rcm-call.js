/* Prepare RCM Call: fixes the exact JSON body and signs it for the Web Booking API (HMAC-SHA256, hex). */
const ctx = Object.assign({}, $input.first().json);
ctx.bodyString = JSON.stringify(ctx.rcmBody);
ctx.signature = ctx.api === 'web' ? AUTH.hmacHex(CONFIG.rcmSharedSecret, ctx.bodyString) : '';
return [{ json: ctx }];

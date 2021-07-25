export{
    TV_URL,
    EXE_PATH,
    COOKIES,
    FLAGS
}

const EXE_PATH = '/usr/bin/brave-browser';
const _COOKIES = 
{
    ['_sp_id.cf1a']: '',
    ['_sp_ses.cf1a']: '',
    ['cachec']: '',
    ['etg']: '',
    ['png']: '',
    ['sessionid']: '',
    ['tv_eculd']: '',
    ['g_state']: '',
    ['will_start_trial']: ''
}
const FLAGS = ['--force-device-scale-factor=0.2']
const TV_URL = 'https://www.tradingview.com';

const COOKIES = () => {
    const cookieKeys = Object.keys(_COOKIES);
    if(!areCookiesValid(cookieKeys)) throw new Error('Invalid cookies');
    return cookieKeys.map(key => {
        return {
            url: TV_URL,
            name: key, 
            value: _COOKIES[key]
        }
    });
}

const areCookiesValid = (keys: string[]): keys is Array<keyof typeof _COOKIES> => 
     keys.every(isCookieValid);

const isCookieValid = (value: string): value is keyof typeof _COOKIES => 
     value in _COOKIES;





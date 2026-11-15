'use strict';

function createInterpolatableProxy(target) {
    return new Proxy(target || {}, {
        get(t, prop) {
            const val = t[prop];
            if (typeof val === 'function') return val;
            if (typeof val === 'string') {
                const fn = (params = {}) => {
                    let res = val;
                    for (const [k, v] of Object.entries(params)) {
                        res = res.replace(new RegExp(`\\{${k}\\}`, 'g'), v);
                    }
                    return res;
                };
                fn.toString = () => val;
                fn.valueOf = () => val;
                fn[Symbol.toPrimitive] = () => val;

                return new Proxy(fn, {
                    get(fnTarget, stringProp) {
                        if (stringProp === 'length') {
                            return String(val).length;
                        }
                        if (stringProp in fnTarget) {
                            return fnTarget[stringProp];
                        }
                        const strVal = String(val);
                        const strPropVal = strVal[stringProp];
                        if (typeof strPropVal === 'function') {
                            return strPropVal.bind(strVal);
                        }
                        return strPropVal;
                    }
                });
            }
            if (typeof val === 'object' && val !== null) {
                return createInterpolatableProxy(val);
            }
            return () => '';
        }
    });
}

module.exports = { createInterpolatableProxy };


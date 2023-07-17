import {z} from "zod";
import CryptoJS from "crypto-js"

type Stringifier<T> = {
    from: (str: string | null) => T | null;
    to: (value: T) => string;
}
declare global {
    interface Window {
        __BetterSession__StorageLocation?: Storage;
        __BetterSession__Encrypt?: boolean;
    }
}


class SessionAccessor<K extends string, T> {
    private mapper: Stringifier<T>;

    private get storage(): Storage {
        return window.__BetterSession__StorageLocation ?? sessionStorage
    }

    private get encrypt(): boolean {
        return window.__BetterSession__Encrypt ?? false
    }

    public key: K;
    private secret: string;

    constructor(key: K, mapper: Stringifier<T>) {
        this.key = key;
        this.mapper = mapper;
        this.secret = randomString(32);
    }

    public get(): T | null {
        const value = this.storage.getItem(this.key);
        if (value === null) return null;

        const encoded = this.encrypt ? CryptoJS.AES.decrypt(value, this.secret).toString(CryptoJS.enc.Utf8) : value;
        const b64decoded = atob(encoded);

        return this.mapper.from(b64decoded)
    }

    public set(value: T) {
        const content = this.mapper.to(value);
        const b64encoded = btoa(content);

        const encoded = this.encrypt ? CryptoJS.AES.encrypt(b64encoded, this.secret).toString() : b64encoded;

        this.storage.setItem(this.key, encoded);
    }


    public remove() {
        this.storage.removeItem(this.key);
    }
}

const randomString = (length: number): string => {
    const cs = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    const seedLength = length * 10;
    const spacing = Math.floor(seedLength / 13);
    const offset = Math.ceil(seedLength / 7);
    let j = 0;
    const isDash = (i: number) => {
        const slime = ++j % 7 ? -j : j;
        return ((i - offset) & spacing + slime) === 0
    };
    const seed = new Array(seedLength).fill(0).map((_, i) => isDash(i) ? '-' : cs[Math.round(Math.random() * cs.length)]).join('')
    const absoluteOffset = Math.floor(Math.random() * (seedLength / 2));
    return seed.substring(absoluteOffset, absoluteOffset + length);
}


const mappers = {

    number: ({
        from: (s: string | null) => s ? parseInt(s, 10) : null,
        to: (v: number) => v.toString(10)
    }) as Stringifier<number>,
    string: ({
        from: (s: string | null) => s,
        to: (s: string) => s
    }) as Stringifier<string>,
    shape: <Shape extends z.ZodRawShape>(shape: Shape) => ({
        from: (s: string | null): z.infer<z.ZodObject<Shape>> | null => {
            return s ? z.object(shape).parse(JSON.parse(s)) : null

        },
        to: (v: z.infer<z.ZodObject<Shape>>): string => JSON.stringify(v)
    }) as Stringifier<z.infer<z.ZodObject<Shape>>>,
    object:
        <Schema extends z.Schema<unknown>>(validator: Schema) => ({
            from: (s: string | null) => s ? validator.parse(JSON.parse(s)) : null,
            to: (v: z.infer<Schema>) => JSON.stringify(v),
        }) as Stringifier<z.infer<Schema>>,
    boolean: {
        from: (s: string | null) => s === 'true',
        to: (v: boolean) => v.toString()
    } as Stringifier<boolean>,
    obfuscatedBoolean: (constant?: CustomBoolean): Stringifier<boolean> => {
        const on = constant?.on ?? randomString(32);
        const off = constant?.off ?? randomString(32);

        return {
            from: (s) => s === on,
            to: (b) => b ? on : off
        };
    },
    json: <T>(): Stringifier<T> => ({ from: s => s ? JSON.parse(s) as T : null, to: o => JSON.stringify(o) })
}
type CustomBoolean = { on: string, off: string }

type BooleanOptions = {
    obfuscate?: false, constants?: never;
} | {
    obfuscate: true;
    constants?: CustomBoolean;
}

export const s = {
    number: <K extends string>(key: K): SessionAccessor<K, number> =>
        new SessionAccessor(key, mappers.number),

    string: <K extends string>(key: K): SessionAccessor<K, string> =>
        new SessionAccessor(key, mappers.string),

    shape: <K extends string, Shape extends z.ZodRawShape>(key: K, shape: Shape): SessionAccessor<K, z.infer<z.ZodObject<Shape>>> =>
        new SessionAccessor(key, mappers.shape(shape)),

    object: <K extends string, Schema extends z.Schema<unknown>>(key: K, validator: Schema): SessionAccessor<K, z.infer<Schema>> =>
        new SessionAccessor(key, mappers.object(validator)),

    type: <T>() => <K extends string>(key:K) => new SessionAccessor<K, T>(key, mappers.json<T>()),

    boolean: <K extends string>(key: K, options?: BooleanOptions): SessionAccessor<K, boolean> =>
        options?.obfuscate ?
            new SessionAccessor(key, mappers.obfuscatedBoolean(options?.constants)) :
            new SessionAccessor(key, mappers.boolean)

}

export type CreateSessionOptions = {
    /**
     *  @default: 'dev'
     */
    mode: 'dev' | 'prod';

    /**
     * @summary Whether to encrypt the values (NOTE: only in prod mode)
     * NOTE: Values will be base64encoded regardless of this setting
     * @default false
     */
    encrypt?: boolean;

    /**
     *  @summary Where to store to
     *  @default: sessionStorage
     */
    storage?: Storage;
}
export const createSession = <Keys>(keys: Keys, options?: CreateSessionOptions) => {
    if (options?.storage) window.__BetterSession__StorageLocation = options.storage;
    if (options?.encrypt && options.mode === 'prod') window.__BetterSession__Encrypt = true;

    return keys;
}

import { z } from "zod";
import CryptoJS from "crypto-js";

export type SessionShim<T> = {
  from: (str: string | null) => T | null;
  to: (value: T) => string;
};
declare global {
  interface Window {
    __BetterSession__StorageLocation?: Storage;
    __BetterSession__Encrypt?: boolean;
  }
}

export class SessionAccessor<K extends string, T> {
  private shim: SessionShim<T>;

  private get storage(): Storage {
    return window.__BetterSession__StorageLocation ?? sessionStorage;
  }

  private get encrypt(): boolean {
    // TODO: Find a better way to store the encryption secrets
    return window.__BetterSession__Encrypt ?? false;
  }

  public key: K;
  private secret: string;

  constructor(key: K, shim: SessionShim<T>) {
    this.key = key;
    this.shim = shim;
    this.secret = randomString(32);
  }

  public get(): T | null {
    const value = this.storage.getItem(this.key);
    if (value === null) return null;

    const encoded = this.encrypt
      ? CryptoJS.AES.decrypt(value, this.secret).toString(CryptoJS.enc.Utf8)
      : value;
    const b64decoded = atob(encoded);

    return this.shim.from(b64decoded);
  }

  public set(value: T) {
    const content = this.shim.to(value);
    const b64encoded = btoa(content);

    const encoded = this.encrypt
      ? CryptoJS.AES.encrypt(b64encoded, this.secret).toString()
      : b64encoded;

    this.storage.setItem(this.key, encoded);
  }

  public remove() {
    this.storage.removeItem(this.key);
  }
}

const randomString = (length: number): string => {
  const cs = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  const seedLength = length * 10;
  const spacing = Math.floor(seedLength / 13);
  const offset = Math.ceil(seedLength / 7);
  let j = 0;
  const isDash = (i: number) => {
    const slime = ++j % 7 ? -j : j;
    return ((i - offset) & (spacing + slime)) === 0;
  };
  const seed = new Array(seedLength)
    .fill(0)
    .map((_, i) =>
      isDash(i) ? "-" : cs[Math.round(Math.random() * cs.length)],
    )
    .join("");
  const absoluteOffset = Math.floor(Math.random() * (seedLength / 2));
  return seed.substring(absoluteOffset, absoluteOffset + length);
};

export const createShim = <T>(
  from: SessionShim<T>["from"],
  to: SessionShim<T>["to"],
): SessionShim<T> => ({ from, to });

const mappers = {
  number: createShim<number>(
    (s) => (s ? parseInt(s, 10) : null),
    (v) => v.toString(10),
  ),
  string: createShim<string>(
    (s) => s,
    (s) => s,
  ),
  date: createShim<Date>(
    (s) => (s ? new Date(parseInt(s, 10)) : null),
    (d) => d.getTime().toString(10),
  ),

  shape: <Shape extends z.ZodRawShape>(shape: Shape) =>
    createShim<z.infer<z.ZodObject<Shape>>>(
      (s): z.infer<z.ZodObject<Shape>> | null => {
        return s ? z.object(shape).parse(JSON.parse(s)) : null;
      },
      (v): string => JSON.stringify(v),
    ),
  object: <Schema extends z.Schema<unknown>>(validator: Schema) =>
    createShim<z.infer<Schema>>(
      (s) => (s ? validator.parse(JSON.parse(s)) : null),
      (v) => JSON.stringify(v),
    ),
  boolean: createShim<boolean>(
    (s) => s === "true",
    (v) => v.toString(),
  ),
  obfuscatedBoolean: (constant?: CustomBoolean) => {
    const on = constant?.on ?? randomString(32);
    const off = constant?.off ?? randomString(32);

    return createShim(
      (s) => s === on,
      (b) => (b ? on : off),
    );
  },
  json: <T>(): SessionShim<T> =>
    createShim(
      (s) => (s ? (JSON.parse(s) as T) : null),
      (o) => JSON.stringify(o),
    ),
};
type CustomBoolean = { on: string; off: string };

type BooleanOptions =
  | {
      obfuscate?: false;
      constants?: never;
    }
  | {
      obfuscate: true;
      constants?: CustomBoolean;
    };

export const s = {
  number: <K extends string>(key: K): SessionAccessor<K, number> =>
    new SessionAccessor(key, mappers.number),

  string: <K extends string>(key: K): SessionAccessor<K, string> =>
    new SessionAccessor(key, mappers.string),

  shape: <K extends string, Shape extends z.ZodRawShape>(
    key: K,
    shape: Shape,
  ): SessionAccessor<K, z.infer<z.ZodObject<Shape>>> =>
    new SessionAccessor(key, mappers.shape(shape)),

  object: <K extends string, Schema extends z.Schema<unknown>>(
    key: K,
    validator: Schema,
  ): SessionAccessor<K, z.infer<Schema>> =>
    new SessionAccessor(key, mappers.object(validator)),

  type:
    <T>() =>
    <K extends string>(key: K) =>
      new SessionAccessor<K, T>(key, mappers.json<T>()),

  boolean: <K extends string>(
    key: K,
    options?: BooleanOptions,
  ): SessionAccessor<K, boolean> =>
    options?.obfuscate
      ? new SessionAccessor(key, mappers.obfuscatedBoolean(options?.constants))
      : new SessionAccessor(key, mappers.boolean),

  date: <K extends string>(key: K): SessionAccessor<K, Date> =>
    new SessionAccessor(key, mappers.date),

  custom: <K extends string, T>(
    key: K,
    shim: SessionShim<T>,
  ): SessionAccessor<K, T> => new SessionAccessor<K, T>(key, shim),
};

export type Session<
  Configuration extends Record<string, SessionAccessor<any, any>>,
> = Configuration & {
  get<K extends keyof Configuration>(
    key: K,
  ): Configuration[K] extends SessionAccessor<any, infer T> ? T | null : never;
  set<K extends keyof Configuration>(
    key: K,
    value: Configuration[K] extends SessionAccessor<any, infer T>
      ? T | null
      : never,
  ): void;

  remove<K extends keyof Configuration>(key: K): void;
  clear(): void;
};

export type CreateSessionOptions = {
  /**
   *  @default: 'dev'
   */
  mode: "dev" | "prod";

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
};
export const createSession = <
  Configuration extends Record<string, SessionAccessor<any, any>>,
>(
  configuration: Configuration,
  options?: CreateSessionOptions,
): Session<Configuration> => {
  if (options?.storage)
    window.__BetterSession__StorageLocation = options.storage;
  if (options?.encrypt && options.mode === "prod")
    window.__BetterSession__Encrypt = true;

  return {
    ...configuration,
    get<K extends keyof Configuration>(
      key: K,
    ): Configuration[K] extends SessionAccessor<any, infer T>
      ? T | null
      : never {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-return
      return configuration[key]?.get() ?? null;
    },
    set<K extends keyof Configuration>(
      key: K,
      value: Configuration[K] extends SessionAccessor<any, infer T>
        ? T | null
        : never,
    ): void {
      configuration[key]?.set(value);
    },
    remove<K extends keyof Configuration>(key: K): void {
      configuration[key].remove();
    },
    clear(): void {
      const storage = window.__BetterSession__StorageLocation ?? sessionStorage;
      storage?.clear();
    },
  };
};

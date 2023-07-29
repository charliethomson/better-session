/* eslint-disable @typescript-eslint/unbound-method */
import {describe, expect, it, vi} from "vitest";
import {createSession, s} from "../session";
import {z} from "zod";

describe('session things', () => {
    let lut: Record<string, string | null> = {};
    const testStorage: Storage = {
        lut,
        removeItem: vi.fn((k) => lut[k] = null),
        key: vi.fn(),
        clear: vi.fn(() => lut = {}),
        getItem: vi.fn((k) => lut[k] ?? null),
        setItem: vi.fn((k, v) => lut[k] = v),
        length: 0
    }

    it('should work', () => {
        const fooValue = "fooValue";
        const barValue = 42;
        const shapedValue = {
            buzz: "bar",
            fizz: "hello!",
        } as const
        const session = createSession({
            foo: s.string('foo'),
            bar: s.number('bar'),
            shaped: s.shape('shaped', {
                fizz: z.string(),
                buzz: z.enum(['foo', 'bar']),
            }),
            object: s.object('object', z.object({
                fizz: z.string(),
                buzz: z.enum(['foo', 'bar']),
            })),
            obfuscatedBoolean: s.boolean('obfuscated', {obfuscate: true}),
            constantBoolean: s.boolean('constantBoolean', {
                obfuscate: true,
                constants: {on: "ThisIsOn", off: "ThisIsOff"}
            }),
            boolean: s.boolean('regulationBoolean'),
            type: s.type<{ foo: string, bar: number }>()("typedef")
        }, {
            mode: 'prod',
            encrypt: true,
            storage: testStorage,
        })


        expect(session.foo.get()).toBeNull();
        expect(session.bar.get()).toBeNull();
        expect(session.shaped.get()).toBeNull();
        expect(session.object.get()).toBeNull();
        expect(session.obfuscatedBoolean.get()).toBeNull();
        expect(session.constantBoolean.get()).toBeNull();
        expect(session.boolean.get()).toBeNull();
        expect(session.type.get()).toBeNull();

        session.foo.set(fooValue);
        session.bar.set(barValue);
        session.shaped.set(shapedValue)
        session.object.set(shapedValue)
        session.obfuscatedBoolean.set(true);
        session.constantBoolean.set(true);
        session.boolean.set(true);
        session.type.set({foo: '123', bar: 321});

        expect(session.foo.get()).toStrictEqual(fooValue);
        expect(session.bar.get()).toStrictEqual(barValue);
        expect(session.shaped.get()).toStrictEqual(shapedValue);
        expect(session.object.get()).toStrictEqual(shapedValue);
        expect(session.obfuscatedBoolean.get()).toStrictEqual(true);
        expect(session.constantBoolean.get()).toStrictEqual(true);
        expect(session.boolean.get()).toStrictEqual(true);
        expect(session.type.get()).toStrictEqual({foo: '123', bar: 321});

        session.obfuscatedBoolean.set(false);
        session.constantBoolean.set(false);
        session.boolean.set(false);
        expect(session.obfuscatedBoolean.get()).toStrictEqual(false);
        expect(session.constantBoolean.get()).toStrictEqual(false);
        expect(session.boolean.get()).toStrictEqual(false);

        session.remove('foo');
        expect(session.foo.get()).toBeNull();
        session.set('foo', fooValue);
        expect(session.foo.get()).toStrictEqual(fooValue);
        // @ts-expect-error pass-number-to-string-key
        session.set('foo', 123);
        // type is incorrect, but it gets converted to a string in the session then is expected to be a string - so this is correct
        expect(session.get('foo')).toStrictEqual('123');
        session.remove('foo');
        expect(session.get('foo')).toBeNull();

        session.clear();
        expect(session.foo.get()).toBeNull();
        expect(session.bar.get()).toBeNull();
        expect(session.shaped.get()).toBeNull();
        expect(session.object.get()).toBeNull();
        expect(session.obfuscatedBoolean.get()).toBeNull();
        expect(session.constantBoolean.get()).toBeNull();
        expect(session.boolean.get()).toBeNull();
        expect(session.type.get()).toBeNull();
    });
})
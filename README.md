## @charliethomson/better-session

### Adds specific and useful typing, and security through obscurity to the browser storage

## Examples
<hr/>

Instead of 
```ts

type User = {
    name: string;
    email: string;
    age: number;
}

const getCurrentUser = (): User | null => {
    const raw = sessionStorage.getItem('currentUser');
    if (!raw) return null;
    return JSON.parse(raw) as User;
}
```

We pre-define the session
```ts
// ~/session.ts
import { s, createSession } from "@charliethomson/better-session";
import { z } from "zod";

export const session = createSession({
    currentUser: s.shape("currentUser", {
        name: z.string(),
        email: z.string(),
        age: z.number(),
    })
}, {
    mode: import.meta.env.VITE_MODE,
});
```

Then, whenever we would have called getCurrentUser, we: 
```ts
import { session } from "~/session";

const currentUser = session.currentUser.get();
/* // ^? { name: string, email: string, age: number } */
```

Working with string, number, and boolean entries is even easier:
```ts
const getToken = (): string | null => {
    return sessionStorage.getItem("ApiToken")
    /*                            ^ magic strings = 🦶🔫 */   
}
const getCounter = (): number | null => {
    const value = sessionStorage.getItem("Counter");
    if (value === null) return null;
    return Number(value) // or parseInt, parseFloat, w/e really
}
const getUserOptedOut = (): boolean => {
    return sessionStorage.getItem("UserOptOut") === true;
}
```

```ts
// ~/session
import { s, createSession } from "@charliethomson/better-session";

export const session = createSession({
    token: s.string('ApiToken'),
    counter: s.number('Counter'),
    userOptedOut: s.boolean('UserOptOut'),
}, {
    mode: import.meta.env.VITE_MODE,
});
```

```ts
const didUserOptOut = session.userOptedOut.get();
const token = session.token.get();
const isLoggedIn = token !== null;

if (!isLoggedIn) return logIn();

if (!didUserOptOut) stealCustomerData(token);
else askCustomerToOptIn(token);
```

Or, in react with the `useSession` hook:
```tsx
// App.tsx
import React, { FC } from "react";
import { session } from "~/session";
import { Button } from "~/components/atoms/Button";

export const App: FC = () => {
    const [didUserOptOut, setDidUserOptOut] = useSession(session.userOptedOut);
    //     ^ reactive     ^ triggers an immediate update to `didUserOptOut`, and sets the session key
    
    return (<div>
        {didUserOptOut 
            ? <p>Are you sure, (please we need your data or we'll go out of business)</p>
            : (
                <div>
                    <h1>Opt out of data tracking?</h1>
                    <Button onClick={() => setDidUserOptOut(false)} size='xl'>No</Button>
                    <Button onClick={() => setDidUserOptOut(true)} size='sm'>Yes (I hope you feel bad)</Button>
                </div>
            )}
    </div>)
    
}
```
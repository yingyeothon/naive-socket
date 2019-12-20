# Naive Socket

This is a very lightweight library to communicate with the opposite using `net.Socket`.

## Rationale

I'm a Serverless programmer and I want to reduce a deployment package size as possible as I can. There are lots of many libraries to do anything in this world but because of this they have the big codebase sometimes. For example, [`ioredis`](https://github.com/luin/ioredis) is the perfect library to use Redis in NodeJS but it is very big to use in Serverless environment.

This library is a very naive wrapper of `net.Socket` so it doesn't have functions to use. This is proper to use only when there is no need for complex features while communicating with the opposite, for example, the case of only sending an one command to Redis and finished.

## Example

### Fire and forget

This is a simple example when we don't expect the boundary of message. It would return any message that returns from the server immediately. So please be careful this message can be truncated because this function can finish before a message fully reached.

```typescript
import NaiveSocket from "@yingyeothon/naive-socket";

const redisNewline = `\r\n`;
const naiveSocket = new NaiveSocket({
  host: "localhost",
  port: 6379
});

export const ping = () =>
  naiveSocket.send({
    message: [`PING`, ``].join(redisNewline)
  });
```

### Using Length

Or, we can wait by the length of expected response when we know the exact length of the message that we want to receive. It helps ensure the message boundary when we communicate multiple commands in this one connection.

```typescript
export const ping = () =>
  naiveSocket.send({
    message: [`PING`, ``].join(redisNewline),
    fulfill: `+PONG`.length
  });
```

### Using RegExp

Or, in some cases, `RegExp` is more useful to check the correct message. This is a simple example to communicate with Redis with 2 cases.

1. Send a message via Redis queue.
2. Retrieve a gameId by userId.

```typescript
export const enqueueGameMessage = (gameId: string, message: any) =>
  naiveSocket.send({
    message: [
      `RPUSH "queue/${gameId}" "${JSON.stringify(JSON.stringify(message))}"`,
      ``
    ].join(redisNewline),
    timeoutMillis: 1000
  });

export const loadGameId = (userId: string) =>
  naiveSocket
    .send({
      message: [`GET "gameId/${userId}"`, ``].join(redisNewline),
      // When the pattern of gameId is UUID.
      fulfill: /^(\$[0-9]+\r\n(?:[0-9A-Za-z_\-]+)\r\n|\$-1\r\n)/,
      timeoutMillis: 1000
    })
    .then(response => response.match(/([0-9A-F\-]+)\r\n/)[1] || "");
```

`timeoutMillis` will help us to prevent infinitely waiting due to invalid `RegExp`.

### Using Matcher

If we want to receive more complex response, for example, like the response of `SMEMBERS` in Redis, we can use `Matcher` for this.

```typescript
import { withMatcher } from "@yingyeothon/naive-socket/lib/match";

export const loadMembers = (membersKey: string) =>
  naiveSocket.send({
    message: [`SMEMBERS "${membersKey}"`, ``].join(redisNewline),
    /* This is the pattern of its result.
     * *COUNT\r\n
     * $LENGTH\r\n
     * SOMETHING-VALUE\r\n
     * ...
     */
    fulfill: withMatcher(m =>
      m
        .check("*")
        .capture("\r\n") // Now, 0 means the count of values.
        .loop(
          0,
          (/* loopIndex */) =>
            m
              .check("$")
              .capture("\r\n") // (1 + 2 * loopIndex) means the length of value.
              .capture("\r\n") // (1 + 2 * loopIndex + 1) means the actual value.
        )
    ),
    timeoutMillis: 1000
  });
```

## License

MIT
